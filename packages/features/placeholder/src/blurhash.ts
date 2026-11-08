import { assertPixelData, downscaleToFit } from "./internal.js";
import type { BlurHashDecodeOptions, BlurHashEncodeOptions, PixelData } from "./types.js";

/**
 * BlurHash (Wolt, MIT) — a DCT placeholder encoded as a short
 * Base83 string (20–30 chars). This is a from-spec TypeScript
 * implementation; it intentionally reproduces the reference
 * algorithm exactly — including its un-centred cosine basis
 * (cos(pi * cx * x / width), no +0.5 offset) and its
 * signed-maximum AC scaling — so hashes are interchangeable
 * with every other BlurHash implementation.
 */

const BASE83 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

function decode83(hash: string, start: number, end: number): number {
  let value = 0;
  for (let i = start; i < end; i++) {
    const digit = BASE83.indexOf(hash[i] as string);
    if (digit < 0) {
      throw new RangeError(`Invalid blurhash character ${JSON.stringify(hash[i])} at index ${i}`);
    }
    value = value * 83 + digit;
  }
  return value;
}

function encode83(value: number, length: number): string {
  let out = "";
  for (let i = 1; i <= length; i++) {
    const digit = Math.floor(value / Math.pow(83, length - i)) % 83;
    out += BASE83[digit];
  }
  return out;
}

function srgbToLinear(byte: number): number {
  const v = byte / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgbByte(linear: number): number {
  const v = Math.max(0, Math.min(1, linear));
  return v <= 0.0031308
    ? Math.trunc(v * 12.92 * 255 + 0.5)
    : Math.trunc((1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255 + 0.5);
}

function signPow(value: number, exp: number): number {
  return (value < 0 ? -1 : 1) * Math.pow(Math.abs(value), exp);
}

type Rgb = [number, number, number];

function encodeDC([r, g, b]: Rgb): number {
  return (linearToSrgbByte(r) << 16) + (linearToSrgbByte(g) << 8) + linearToSrgbByte(b);
}

function decodeDC(value: number): Rgb {
  return [srgbToLinear(value >> 16), srgbToLinear((value >> 8) & 255), srgbToLinear(value & 255)];
}

function encodeAC([r, g, b]: Rgb, maximumValue: number): number {
  const quantise = (v: number) =>
    Math.max(0, Math.min(18, Math.floor(signPow(v / maximumValue, 0.5) * 9 + 9.5)));
  return quantise(r) * 19 * 19 + quantise(g) * 19 + quantise(b);
}

function decodeAC(value: number, maximumValue: number): Rgb {
  const quantR = Math.floor(value / (19 * 19));
  const quantG = Math.floor(value / 19) % 19;
  const quantB = value % 19;
  return [
    signPow((quantR - 9) / 9, 2) * maximumValue,
    signPow((quantG - 9) / 9, 2) * maximumValue,
    signPow((quantB - 9) / 9, 2) * maximumValue,
  ];
}

function componentsOf(hash: string): { componentX: number; componentY: number } {
  const sizeFlag = decode83(hash, 0, 1);
  return { componentX: (sizeFlag % 9) + 1, componentY: Math.floor(sizeFlag / 9) + 1 };
}

function assertValidBlurHash(hash: string): void {
  if (!hash || hash.length < 6) {
    throw new RangeError("The blurhash string must be at least 6 characters");
  }
  const { componentX, componentY } = componentsOf(hash);
  const expected = 4 + 2 * componentX * componentY;
  if (hash.length !== expected) {
    throw new RangeError(
      `blurhash length mismatch: length is ${hash.length} but it should be ${expected}`,
    );
  }
}

/** The component counts a BlurHash string was encoded with. */
export function blurHashComponents(hash: string): { componentX: number; componentY: number } {
  assertValidBlurHash(hash);
  return componentsOf(hash);
}

/** Length/character-shape validation, mirroring the reference `isBlurhashValid`. */
export function isValidBlurHash(hash: string): boolean {
  try {
    assertValidBlurHash(hash);
    return true;
  } catch {
    return false;
  }
}

/** Encode pixels to a BlurHash string. Alpha is ignored (BlurHash has no alpha channel). */
export function encodeBlurHash(input: PixelData, options: BlurHashEncodeOptions = {}): string {
  assertPixelData(input);
  const componentX = options.componentX ?? 4;
  const componentY = options.componentY ?? 3;
  if (
    !Number.isInteger(componentX) ||
    !Number.isInteger(componentY) ||
    componentX < 1 ||
    componentX > 9 ||
    componentY < 1 ||
    componentY > 9
  ) {
    throw new RangeError(
      `BlurHash must have between 1 and 9 components per axis, got ${componentX}x${componentY}`,
    );
  }
  const data = downscaleToFit(input, options.maxSize ?? 128);
  const { width, height } = data;
  const pixels = data.data;

  const factors: Rgb[] = [];
  for (let cy = 0; cy < componentY; cy++) {
    for (let cx = 0; cx < componentX; cx++) {
      const normalisation = cx === 0 && cy === 0 ? 1 : 2;
      let r = 0;
      let g = 0;
      let b = 0;
      // Accumulation order (x outer, y inner) mirrors the
      // reference implementation so float sums — and therefore
      // the quantised hash — come out identical.
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          const basis =
            normalisation *
            Math.cos((Math.PI * cx * x) / width) *
            Math.cos((Math.PI * cy * y) / height);
          const i = (y * width + x) * 4;
          r += basis * srgbToLinear(pixels[i] as number);
          g += basis * srgbToLinear(pixels[i + 1] as number);
          b += basis * srgbToLinear(pixels[i + 2] as number);
        }
      }
      const scale = 1 / (width * height);
      factors.push([r * scale, g * scale, b * scale]);
    }
  }

  const dc = factors[0] as Rgb;
  const ac = factors.slice(1);
  let hash = encode83(componentX - 1 + (componentY - 1) * 9, 1);
  let actualMaximumValue = 1;
  if (ac.length > 0) {
    // Reference quirk, mirrored deliberately: the "maximum" is
    // the largest SIGNED component across the AC factors, not
    // the largest absolute value. Negative-dominant images
    // therefore quantise against a smaller scale (and some
    // terms clip) — exactly like the reference encoder, so
    // hashes stay interchangeable with it.
    let maximumValue = -Infinity;
    for (const [r, g, b] of ac) {
      maximumValue = Math.max(maximumValue, r, g, b);
    }
    const quantisedMaximumValue = Math.max(0, Math.min(82, Math.floor(maximumValue * 166 - 0.5)));
    actualMaximumValue = (quantisedMaximumValue + 1) / 166;
    hash += encode83(quantisedMaximumValue, 1);
  } else {
    hash += encode83(0, 1);
  }
  hash += encode83(encodeDC(dc), 4);
  for (const factor of ac) {
    hash += encode83(encodeAC(factor, actualMaximumValue), 2);
  }
  return hash;
}

/** Decode a BlurHash string to pixels at the requested size. Output alpha is always 255. */
export function decodeBlurHash(
  hash: string,
  width: number,
  height: number,
  options: BlurHashDecodeOptions = {},
): PixelData {
  assertValidBlurHash(hash);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`Decode dimensions must be positive integers, got ${width}x${height}`);
  }
  const { componentX, componentY } = componentsOf(hash);
  const punch = options.punch ?? 1;
  const maximumValue = (decode83(hash, 1, 2) + 1) / 166;

  const factors: Rgb[] = [];
  const factorCount = componentX * componentY;
  for (let i = 0; i < factorCount; i++) {
    if (i === 0) {
      factors.push(decodeDC(decode83(hash, 2, 6)));
    } else {
      factors.push(decodeAC(decode83(hash, 4 + i * 2, 6 + i * 2), maximumValue * punch));
    }
  }

  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let cy = 0; cy < componentY; cy++) {
        for (let cx = 0; cx < componentX; cx++) {
          const basis =
            Math.cos((Math.PI * cx * x) / width) * Math.cos((Math.PI * cy * y) / height);
          const factor = factors[cx + cy * componentX] as Rgb;
          r += factor[0] * basis;
          g += factor[1] * basis;
          b += factor[2] * basis;
        }
      }
      const i = (y * width + x) * 4;
      out[i] = linearToSrgbByte(r);
      out[i + 1] = linearToSrgbByte(g);
      out[i + 2] = linearToSrgbByte(b);
      out[i + 3] = 255;
    }
  }
  return { data: out, width, height };
}
