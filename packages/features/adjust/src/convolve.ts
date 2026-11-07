import type { PixelData } from "./types.js";

function assertPixels(pixels: PixelData): void {
  if (pixels.data.length !== pixels.width * pixels.height * 4) {
    throw new RangeError("PixelData length does not match its dimensions.");
  }
}

/**
 * Applies a 3x3 convolution kernel (row-major). Edge pixels clamp
 * (replicate) — the standard choice for photo adjustments. Alpha
 * is copied through untouched (kernels apply to colour only).
 */
export function convolve3x3(pixels: PixelData, kernel: readonly number[]): PixelData {
  assertPixels(pixels);
  if (kernel.length !== 9) {
    throw new RangeError(`kernel must have exactly 9 entries, got ${kernel.length}.`);
  }
  const { width: w, height: h } = pixels;
  const out: PixelData = { data: new Uint8ClampedArray(pixels.data), width: w, height: h };
  const src = pixels.data;
  const dst = out.data;
  const at = (x: number, y: number, c: number) =>
    src[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + c]!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            sum += at(x + kx, y + ky, c) * kernel[k++]!;
          }
        }
        dst[(y * w + x) * 4 + c] = sum;
      }
    }
  }
  return out;
}

/** Classic sharpen kernel scaled by amount (0 = unchanged). */
export function sharpen(pixels: PixelData, amount = 0.5): PixelData {
  if (typeof amount !== "number" || !(amount >= 0 && amount <= 5)) {
    throw new RangeError(`amount must be between 0 and 5, got ${String(amount)}.`);
  }
  const a = amount;
  return convolve3x3(pixels, [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0]);
}

/** Separable box blur with a pixel radius (edge-clamped). Two passes, O(w*h) per pass row/col. */
export function boxBlur(pixels: PixelData, radius: number): PixelData {
  assertPixels(pixels);
  if (!Number.isInteger(radius) || radius < 0) {
    throw new RangeError(`radius must be a non-negative integer, got ${String(radius)}.`);
  }
  if (radius === 0) {
    return { data: new Uint8ClampedArray(pixels.data), width: pixels.width, height: pixels.height };
  }
  const { width: w, height: h } = pixels;
  const pass = (input: Uint8ClampedArray, horizontal: boolean): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(input.length);
    const windowSize = radius * 2 + 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 4; c++) {
          let sum = 0;
          for (let k = -radius; k <= radius; k++) {
            const sx = horizontal ? Math.min(w - 1, Math.max(0, x + k)) : x;
            const sy = horizontal ? y : Math.min(h - 1, Math.max(0, y + k));
            sum += input[(sy * w + sx) * 4 + c]!;
          }
          out[(y * w + x) * 4 + c] = sum / windowSize;
        }
      }
    }
    return out;
  };
  const afterH = pass(pixels.data, true);
  const afterV = pass(afterH, false);
  return { data: afterV, width: w, height: h };
}

/**
 * Gaussian-approximating blur: three box passes with radii derived
 * from sigma (the standard technique browsers themselves use).
 */
export function gaussianBlur(pixels: PixelData, sigma: number): PixelData {
  if (typeof sigma !== "number" || !(sigma > 0) || !Number.isFinite(sigma)) {
    throw new RangeError(`sigma must be a positive finite number, got ${String(sigma)}.`);
  }
  // Box sizes for a 3-pass approximation (W3C filter-effects maths).
  const wIdeal = Math.sqrt((12 * sigma * sigma) / 3 + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - 3 * wl * wl - 12 * wl - 3) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  let result = pixels;
  for (let i = 0; i < 3; i++) {
    const radius = Math.floor((i < m ? wl : wu) / 2);
    result = boxBlur(result, radius);
  }
  return result;
}
