import { assertPixelData, downscaleToFit } from "./internal.js";
import type { PixelData, ThumbHashEncodeOptions } from "./types.js";

/**
 * ThumbHash (Evan Wallace, MIT) — a DCT placeholder packed into
 * ~25–35 bytes. Unlike BlurHash it encodes the aspect ratio and
 * an alpha channel, with more detail per byte. This is a
 * from-spec TypeScript implementation that mirrors the
 * reference algorithm's math and loop order exactly, so hashes
 * are interchangeable with every other ThumbHash
 * implementation. (Decoded output goes into a Uint8ClampedArray
 * per this family's PixelData convention, so a channel can
 * differ by at most 1 from the reference's truncating
 * Uint8Array writes.)
 */

type Channel = [dc: number, ac: number[], scale: number];

function readHeaders(hash: Uint8Array) {
  const header24 = (hash[0] as number) | ((hash[1] as number) << 8) | ((hash[2] as number) << 16);
  const header16 = (hash[3] as number) | ((hash[4] as number) << 8);
  return { header24, header16 };
}

/** Encode pixels to a ThumbHash (raw bytes; see thumbHashToBase64 for a string form). */
export function encodeThumbHash(
  input: PixelData,
  options: ThumbHashEncodeOptions = {},
): Uint8Array {
  assertPixelData(input);
  const maxSize = Math.max(1, Math.min(100, options.maxSize ?? 100));
  const data = downscaleToFit(input, maxSize);
  const { width: w, height: h } = data;
  const rgba = data.data;
  const { PI, round, max, cos, abs } = Math;

  // Determine the average color
  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  let avgA = 0;
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const alpha = (rgba[j + 3] as number) / 255;
    avgR += (alpha / 255) * (rgba[j] as number);
    avgG += (alpha / 255) * (rgba[j + 1] as number);
    avgB += (alpha / 255) * (rgba[j + 2] as number);
    avgA += alpha;
  }
  if (avgA) {
    avgR /= avgA;
    avgG /= avgA;
    avgB /= avgA;
  }

  const hasAlpha = avgA < w * h;
  const lLimit = hasAlpha ? 5 : 7; // Use fewer luminance bits if there's alpha
  const lx = max(1, round((lLimit * w) / max(w, h)));
  const ly = max(1, round((lLimit * h) / max(w, h)));
  const l = new Float64Array(w * h); // luminance
  const p = new Float64Array(w * h); // yellow - blue
  const q = new Float64Array(w * h); // red - green
  const a = new Float64Array(w * h); // alpha

  // Convert the image from RGBA to LPQA (composite atop the average color)
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const alpha = (rgba[j + 3] as number) / 255;
    const r = avgR * (1 - alpha) + (alpha / 255) * (rgba[j] as number);
    const g = avgG * (1 - alpha) + (alpha / 255) * (rgba[j + 1] as number);
    const b = avgB * (1 - alpha) + (alpha / 255) * (rgba[j + 2] as number);
    l[i] = (r + g + b) / 3;
    p[i] = (r + g) / 2 - b;
    q[i] = r - g;
    a[i] = alpha;
  }

  // Encode using the DCT into DC (constant) and normalized AC (varying) terms
  const encodeChannel = (channel: Float64Array, nx: number, ny: number): Channel => {
    let dc = 0;
    let scale = 0;
    const ac: number[] = [];
    const fx = new Float64Array(w);
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx * ny < nx * (ny - cy); cx++) {
        let f = 0;
        for (let x = 0; x < w; x++) fx[x] = cos((PI / w) * cx * (x + 0.5));
        for (let y = 0; y < h; y++) {
          const fy = cos((PI / h) * cy * (y + 0.5));
          for (let x = 0; x < w; x++) f += (channel[x + y * w] as number) * (fx[x] as number) * fy;
        }
        f /= w * h;
        if (cx || cy) {
          ac.push(f);
          scale = max(scale, abs(f));
        } else {
          dc = f;
        }
      }
    }
    if (scale) {
      for (let i = 0; i < ac.length; i++) ac[i] = 0.5 + (0.5 / scale) * (ac[i] as number);
    }
    return [dc, ac, scale];
  };
  const [lDc, lAc, lScale] = encodeChannel(l, max(3, lx), max(3, ly));
  const [pDc, pAc, pScale] = encodeChannel(p, 3, 3);
  const [qDc, qAc, qScale] = encodeChannel(q, 3, 3);
  const [aDc, aAc, aScale] = hasAlpha ? encodeChannel(a, 5, 5) : [0, [] as number[], 0];

  // Write the constants
  const isLandscape = w > h;
  const header24 =
    round(63 * lDc) |
    (round(31.5 + 31.5 * pDc) << 6) |
    (round(31.5 + 31.5 * qDc) << 12) |
    (round(31 * lScale) << 18) |
    ((hasAlpha ? 1 : 0) << 23);
  const header16 =
    (isLandscape ? ly : lx) |
    (round(63 * pScale) << 3) |
    (round(63 * qScale) << 9) |
    ((isLandscape ? 1 : 0) << 15);
  const acStart = hasAlpha ? 6 : 5;
  const channels = hasAlpha ? [lAc, pAc, qAc, aAc] : [lAc, pAc, qAc];
  const nibbleCount = channels.reduce((n, ac) => n + ac.length, 0);
  const hash = new Uint8Array(acStart + Math.ceil(nibbleCount / 2));
  hash[0] = header24 & 255;
  hash[1] = (header24 >> 8) & 255;
  hash[2] = header24 >> 16;
  hash[3] = header16 & 255;
  hash[4] = header16 >> 8;
  if (hasAlpha) hash[5] = round(15 * aDc) | (round(15 * aScale) << 4);

  // Write the varying factors
  let acIndex = 0;
  for (const ac of channels) {
    for (const f of ac) {
      const at = acStart + (acIndex >> 1);
      hash[at] = (hash[at] as number) | (round(15 * f) << ((acIndex++ & 1) << 2));
    }
  }
  return hash;
}

function countCoefficients(nx: number, ny: number): number {
  let n = 0;
  for (let cy = 0; cy < ny; cy++) {
    for (let cx = cy ? 0 : 1; cx * ny < nx * (ny - cy); cx++) n++;
  }
  return n;
}

/** Decode a ThumbHash to pixels. The size (~32px on the long side) comes from the hash itself. */
export function decodeThumbHash(hash: Uint8Array): PixelData {
  const { PI, min, max, cos, round } = Math;
  if (!hash || hash.length < 5) {
    throw new RangeError(`ThumbHash needs at least 5 bytes, got ${hash?.length}`);
  }
  const { header24, header16 } = readHeaders(hash);
  const lDc = (header24 & 63) / 63;
  const pDc = ((header24 >> 6) & 63) / 31.5 - 1;
  const qDc = ((header24 >> 12) & 63) / 31.5 - 1;
  const lScale = ((header24 >> 18) & 31) / 31;
  const hasAlpha = header24 >> 23;
  const pScale = ((header16 >> 3) & 63) / 63;
  const qScale = ((header16 >> 9) & 63) / 63;
  const isLandscape = header16 >> 15;
  const lx = max(3, isLandscape ? (hasAlpha ? 5 : 7) : header16 & 7);
  const ly = max(3, isLandscape ? header16 & 7 : hasAlpha ? 5 : 7);
  const aDc = hasAlpha ? ((hash[5] as number) & 15) / 15 : 1;
  const aScale = hasAlpha ? ((hash[5] as number) >> 4) / 15 : 0;

  const acStart = hasAlpha ? 6 : 5;
  const nibbleCount =
    countCoefficients(lx, ly) +
    countCoefficients(3, 3) * 2 +
    (hasAlpha ? countCoefficients(5, 5) : 0);
  if (hash.length < acStart + Math.ceil(nibbleCount / 2)) {
    throw new RangeError(
      `ThumbHash is truncated: header promises ${nibbleCount} AC coefficients (${acStart + Math.ceil(nibbleCount / 2)} bytes), got ${hash.length} bytes`,
    );
  }

  // Read the varying factors (boost saturation by 1.25x to compensate for quantization)
  let acIndex = 0;
  const decodeChannel = (nx: number, ny: number, scale: number): number[] => {
    const ac: number[] = [];
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = cy ? 0 : 1; cx * ny < nx * (ny - cy); cx++) {
        const nibble = ((hash[acStart + (acIndex >> 1)] as number) >> ((acIndex++ & 1) << 2)) & 15;
        ac.push((nibble / 7.5 - 1) * scale);
      }
    }
    return ac;
  };
  const lAc = decodeChannel(lx, ly, lScale);
  const pAc = decodeChannel(3, 3, pScale * 1.25);
  const qAc = decodeChannel(3, 3, qScale * 1.25);
  const aAc = hasAlpha ? decodeChannel(5, 5, aScale) : [];

  // Decode using the DCT into RGB
  const ratio = thumbHashAspectRatio(hash);
  const w = round(ratio > 1 ? 32 : 32 * ratio);
  const h = round(ratio > 1 ? 32 / ratio : 32);
  const rgba = new Uint8ClampedArray(w * h * 4);
  const fx = new Float64Array(max(lx, ly, 5));
  const fy = new Float64Array(max(lx, ly, 5));
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      let ll = lDc;
      let pp = pDc;
      let qq = qDc;
      let aa = aDc;

      // Precompute the coefficients
      for (let cx = 0, n = max(lx, hasAlpha ? 5 : 3); cx < n; cx++) {
        fx[cx] = cos((PI / w) * (x + 0.5) * cx);
      }
      for (let cy = 0, n = max(ly, hasAlpha ? 5 : 3); cy < n; cy++) {
        fy[cy] = cos((PI / h) * (y + 0.5) * cy);
      }

      // Decode L
      for (let cy = 0, j = 0; cy < ly; cy++) {
        for (
          let cx = cy ? 0 : 1, fy2 = (fy[cy] as number) * 2;
          cx * ly < lx * (ly - cy);
          cx++, j++
        ) {
          ll += (lAc[j] as number) * (fx[cx] as number) * fy2;
        }
      }

      // Decode P and Q
      for (let cy = 0, j = 0; cy < 3; cy++) {
        for (let cx = cy ? 0 : 1, fy2 = (fy[cy] as number) * 2; cx < 3 - cy; cx++, j++) {
          const f = (fx[cx] as number) * fy2;
          pp += (pAc[j] as number) * f;
          qq += (qAc[j] as number) * f;
        }
      }

      // Decode A
      if (hasAlpha) {
        for (let cy = 0, j = 0; cy < 5; cy++) {
          for (let cx = cy ? 0 : 1, fy2 = (fy[cy] as number) * 2; cx < 5 - cy; cx++, j++) {
            aa += (aAc[j] as number) * (fx[cx] as number) * fy2;
          }
        }
      }

      // Convert to RGB
      const b = ll - (2 / 3) * pp;
      const r = (3 * ll - b + qq) / 2;
      const g = r - qq;
      rgba[i] = max(0, 255 * min(1, r));
      rgba[i + 1] = max(0, 255 * min(1, g));
      rgba[i + 2] = max(0, 255 * min(1, b));
      rgba[i + 3] = max(0, 255 * min(1, aa));
    }
  }
  return { data: rgba, width: w, height: h };
}

/** The average colour stored in a ThumbHash, as 0..1 floats (alpha included). */
export function thumbHashAverageColor(hash: Uint8Array): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  if (!hash || hash.length < 5) {
    throw new RangeError(`ThumbHash needs at least 5 bytes, got ${hash?.length}`);
  }
  const { min, max } = Math;
  const { header24 } = readHeaders(hash);
  const l = (header24 & 63) / 63;
  const p = ((header24 >> 6) & 63) / 31.5 - 1;
  const q = ((header24 >> 12) & 63) / 31.5 - 1;
  const hasAlpha = header24 >> 23;
  const a = hasAlpha ? ((hash[5] as number) & 15) / 15 : 1;
  const b = l - (2 / 3) * p;
  const r = (3 * l - b + q) / 2;
  const g = r - q;
  return { r: max(0, min(1, r)), g: max(0, min(1, g)), b: max(0, min(1, b)), a };
}

/** The approximate width/height aspect ratio of the original image, from the hash alone. */
export function thumbHashAspectRatio(hash: Uint8Array): number {
  if (!hash || hash.length < 5) {
    throw new RangeError(`ThumbHash needs at least 5 bytes, got ${hash?.length}`);
  }
  const header = hash[3] as number;
  const hasAlpha = (hash[2] as number) & 0x80;
  const isLandscape = (hash[4] as number) & 0x80;
  const lx = isLandscape ? (hasAlpha ? 5 : 7) : header & 7;
  const ly = isLandscape ? header & 7 : hasAlpha ? 5 : 7;
  return lx / ly;
}

/** Raw hash bytes → base64 string (the form ThumbHashes are usually stored/sent in). */
export function thumbHashToBase64(hash: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < hash.length; i += CHUNK) {
    binary += String.fromCharCode(...hash.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Base64 string → raw hash bytes. Throws RangeError on malformed base64. */
export function thumbHashFromBase64(text: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(text);
  } catch {
    throw new RangeError("Invalid base64 ThumbHash string");
  }
  const hash = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) hash[i] = binary.charCodeAt(i);
  return hash;
}
