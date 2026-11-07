import type { PixelData, RgbaColor } from "./types.js";

function assertPixels(pixels: PixelData): void {
  if (pixels.data.length !== pixels.width * pixels.height * 4) {
    throw new RangeError(
      `PixelData length ${pixels.data.length} does not match ${pixels.width}x${pixels.height} RGBA.`,
    );
  }
}

function blank(width: number, height: number): PixelData {
  return { data: new Uint8ClampedArray(width * height * 4), width, height };
}

/** Flips left-right. Exact pixel permutation; returns a new PixelData. */
export function flipHorizontal(pixels: PixelData): PixelData {
  assertPixels(pixels);
  const { width: w, height: h } = pixels;
  const out = blank(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4;
      const dst = (y * w + (w - 1 - x)) * 4;
      out.data[dst] = pixels.data[src]!;
      out.data[dst + 1] = pixels.data[src + 1]!;
      out.data[dst + 2] = pixels.data[src + 2]!;
      out.data[dst + 3] = pixels.data[src + 3]!;
    }
  }
  return out;
}

/** Flips top-bottom. Exact pixel permutation; returns a new PixelData. */
export function flipVertical(pixels: PixelData): PixelData {
  assertPixels(pixels);
  const { width: w, height: h } = pixels;
  const out = blank(w, h);
  const rowBytes = w * 4;
  for (let y = 0; y < h; y++) {
    const srcStart = y * rowBytes;
    const dstStart = (h - 1 - y) * rowBytes;
    out.data.set(pixels.data.subarray(srcStart, srcStart + rowBytes), dstStart);
  }
  return out;
}

/**
 * Rotates by quarter turns clockwise (1, 2 or 3; negative values
 * wrap, so -1 = one turn counter-clockwise). Exact pixel
 * permutation — no resampling, no quality loss.
 */
export function rotateQuarter(pixels: PixelData, turns: number): PixelData {
  assertPixels(pixels);
  if (!Number.isInteger(turns)) {
    throw new RangeError(`turns must be an integer, got ${String(turns)}.`);
  }
  const normalized = ((turns % 4) + 4) % 4;
  if (normalized === 0) {
    return { data: new Uint8ClampedArray(pixels.data), width: pixels.width, height: pixels.height };
  }
  if (normalized === 2) {
    const out = blank(pixels.width, pixels.height);
    const n = pixels.width * pixels.height;
    for (let i = 0; i < n; i++) {
      const src = i * 4;
      const dst = (n - 1 - i) * 4;
      out.data[dst] = pixels.data[src]!;
      out.data[dst + 1] = pixels.data[src + 1]!;
      out.data[dst + 2] = pixels.data[src + 2]!;
      out.data[dst + 3] = pixels.data[src + 3]!;
    }
    return out;
  }
  // 1 or 3 quarter turns: dimensions swap.
  const { width: w, height: h } = pixels;
  const out = blank(h, w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4;
      // CW (1): (x, y) -> (h-1-y, x). CCW (3): (x, y) -> (y, w-1-x).
      const dx = normalized === 1 ? h - 1 - y : y;
      const dy = normalized === 1 ? x : w - 1 - x;
      const dst = (dy * h + dx) * 4;
      out.data[dst] = pixels.data[src]!;
      out.data[dst + 1] = pixels.data[src + 1]!;
      out.data[dst + 2] = pixels.data[src + 2]!;
      out.data[dst + 3] = pixels.data[src + 3]!;
    }
  }
  return out;
}

/**
 * Composites every pixel over a solid background colour
 * (source-over). Fully opaque inputs pass through unchanged in
 * colour; transparent pixels become the background.
 */
export function fillBackground(pixels: PixelData, color: RgbaColor): PixelData {
  assertPixels(pixels);
  const out: PixelData = {
    data: new Uint8ClampedArray(pixels.data.length),
    width: pixels.width,
    height: pixels.height,
  };
  const bgA = (color.a ?? 255) / 255;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const a = pixels.data[i + 3]! / 255;
    const inv = 1 - a;
    const outA = a + bgA * inv;
    if (outA === 0) {
      out.data[i + 3] = 0;
      continue;
    }
    out.data[i] = (pixels.data[i]! * a + color.r * bgA * inv) / outA;
    out.data[i + 1] = (pixels.data[i + 1]! * a + color.g * bgA * inv) / outA;
    out.data[i + 2] = (pixels.data[i + 2]! * a + color.b * bgA * inv) / outA;
    out.data[i + 3] = outA * 255;
  }
  return out;
}
