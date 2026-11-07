import type { AdjustOptions, PixelData } from "./types.js";

function assertPixels(pixels: PixelData): void {
  if (pixels.data.length !== pixels.width * pixels.height * 4) {
    throw new RangeError(
      `PixelData length ${pixels.data.length} does not match ${pixels.width}x${pixels.height} RGBA.`,
    );
  }
}

function range(name: string, value: number, min: number, max: number): number {
  if (typeof value !== "number" || !(value >= min && value <= max)) {
    throw new RangeError(`${name} must be between ${min} and ${max}, got ${String(value)}.`);
  }
  return value;
}

export interface ResolvedAdjustOptions {
  brightness: number;
  contrast: number;
  exposure: number;
  gamma: number;
  saturation: number;
  hueRotate: number;
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
}

/** Applies defaults and validates an AdjustOptions (pure; unit tested). */
export function resolveAdjustOptions(options: AdjustOptions = {}): ResolvedAdjustOptions {
  const gamma = options.gamma ?? 1;
  if (typeof gamma !== "number" || !(gamma > 0) || !Number.isFinite(gamma)) {
    throw new RangeError(`gamma must be a positive finite number, got ${String(gamma)}.`);
  }
  const hueRotate = options.hueRotate ?? 0;
  if (typeof hueRotate !== "number" || !Number.isFinite(hueRotate)) {
    throw new RangeError(`hueRotate must be finite, got ${String(hueRotate)}.`);
  }
  return {
    brightness: range("brightness", options.brightness ?? 0, -1, 1),
    contrast: range("contrast", options.contrast ?? 0, -1, 1),
    exposure: range("exposure", options.exposure ?? 0, -10, 10),
    gamma,
    saturation: range("saturation", options.saturation ?? 0, -1, 10),
    hueRotate,
    grayscale: options.grayscale ?? false,
    sepia: options.sepia ?? false,
    invert: options.invert ?? false,
  };
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Applies point adjustments in ONE pass, in this fixed, documented
 * order: exposure → brightness → contrast → gamma → hue-rotate →
 * saturation → grayscale → sepia → invert. Alpha is never touched.
 * Returns a new PixelData.
 */
export function adjust(pixels: PixelData, options: AdjustOptions = {}): PixelData {
  assertPixels(pixels);
  const o = resolveAdjustOptions(options);
  const out: PixelData = {
    data: new Uint8ClampedArray(pixels.data),
    width: pixels.width,
    height: pixels.height,
  };
  const d = out.data;

  const exposureMul = Math.pow(2, o.exposure);
  const brightnessAdd = o.brightness * 255;
  // Contrast as a slope through (0.5, 0.5): c in -1..1 -> slope 1/(1-c) for c>0 handled via tan form.
  const contrastSlope = o.contrast >= 0 ? 1 / Math.max(0.0001, 1 - o.contrast) : 1 + o.contrast;
  const invGamma = 1 / o.gamma;
  // Per-channel LUT for the exposure/brightness/contrast/gamma chain.
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    let x = v * exposureMul;
    x += brightnessAdd;
    x = (x - 128) * contrastSlope + 128;
    x = 255 * Math.pow(clamp255(x) / 255, invGamma);
    lut[v] = clamp255(x);
  }
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]!]!;
    d[i + 1] = lut[d[i + 1]!]!;
    d[i + 2] = lut[d[i + 2]!]!;
  }

  if (o.hueRotate !== 0 || o.saturation !== 0) {
    const angle = ((o.hueRotate % 360) + 360) % 360;
    const rad = (angle * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    // Hue-rotation matrix (YIQ-space rotation, the SVG feColorMatrix formulation).
    const m00 = 0.213 + cosA * 0.787 - sinA * 0.213;
    const m01 = 0.715 - cosA * 0.715 - sinA * 0.715;
    const m02 = 0.072 - cosA * 0.072 + sinA * 0.928;
    const m10 = 0.213 - cosA * 0.213 + sinA * 0.143;
    const m11 = 0.715 + cosA * 0.285 + sinA * 0.14;
    const m12 = 0.072 - cosA * 0.072 - sinA * 0.283;
    const m20 = 0.213 - cosA * 0.213 - sinA * 0.787;
    const m21 = 0.715 - cosA * 0.715 + sinA * 0.715;
    const m22 = 0.072 + cosA * 0.928 + sinA * 0.072;
    const satMul = 1 + o.saturation;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      let nr = r * m00 + g * m01 + b * m02;
      let ng = r * m10 + g * m11 + b * m12;
      let nb = r * m20 + g * m21 + b * m22;
      if (o.saturation !== 0) {
        const lum = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;
        nr = lum + (nr - lum) * satMul;
        ng = lum + (ng - lum) * satMul;
        nb = lum + (nb - lum) * satMul;
      }
      d[i] = clamp255(nr);
      d[i + 1] = clamp255(ng);
      d[i + 2] = clamp255(nb);
    }
  }

  if (o.grayscale || o.sepia) {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      if (o.sepia) {
        d[i] = clamp255(r * 0.393 + g * 0.769 + b * 0.189);
        d[i + 1] = clamp255(r * 0.349 + g * 0.686 + b * 0.168);
        d[i + 2] = clamp255(r * 0.272 + g * 0.534 + b * 0.131);
      } else {
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        d[i] = lum;
        d[i + 1] = lum;
        d[i + 2] = lum;
      }
    }
  }

  if (o.invert) {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i]!;
      d[i + 1] = 255 - d[i + 1]!;
      d[i + 2] = 255 - d[i + 2]!;
    }
  }
  return out;
}

/** Convenience single-purpose wrappers (same maths as adjust()). */
export const brightness = (p: PixelData, amount: number) => adjust(p, { brightness: amount });
export const contrast = (p: PixelData, amount: number) => adjust(p, { contrast: amount });
export const saturation = (p: PixelData, amount: number) => adjust(p, { saturation: amount });
export const grayscale = (p: PixelData) => adjust(p, { grayscale: true });
export const sepia = (p: PixelData) => adjust(p, { sepia: true });
export const invert = (p: PixelData) => adjust(p, { invert: true });
