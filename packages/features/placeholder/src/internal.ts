import type { PixelData } from "./types.js";

/** Shared validation for every public entry point in this package. */
export function assertPixelData(input: PixelData): void {
  if (!input || typeof input !== "object") {
    throw new RangeError("PixelData input is required");
  }
  const { data, width, height } = input;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`PixelData dimensions must be positive integers, got ${width}x${height}`);
  }
  if (!data || data.length !== width * height * 4) {
    throw new RangeError(
      `PixelData data length must be width*height*4 (${width * height * 4}), got ${data?.length}`,
    );
  }
}

/**
 * Box-average downscale so both dimensions fit `maxSize`,
 * preserving aspect ratio. Never upscales; returns the input
 * unchanged when it already fits or `maxSize` is not finite.
 */
export function downscaleToFit(input: PixelData, maxSize: number): PixelData {
  const { width, height } = input;
  if (!Number.isFinite(maxSize) || Math.max(width, height) <= maxSize) {
    return input;
  }
  const scale = maxSize / Math.max(width, height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const sums = new Float64Array(w * h * 4);
  const counts = new Uint32Array(w * h);
  for (let y = 0; y < height; y++) {
    const dy = Math.min(h - 1, Math.floor((y * h) / height));
    for (let x = 0; x < width; x++) {
      const dx = Math.min(w - 1, Math.floor((x * w) / width));
      const src = (y * width + x) * 4;
      const dst = (dy * w + dx) * 4;
      sums[dst] = (sums[dst] as number) + (input.data[src] as number);
      sums[dst + 1] = (sums[dst + 1] as number) + (input.data[src + 1] as number);
      sums[dst + 2] = (sums[dst + 2] as number) + (input.data[src + 2] as number);
      sums[dst + 3] = (sums[dst + 3] as number) + (input.data[src + 3] as number);
      const ci = dy * w + dx;
      counts[ci] = (counts[ci] as number) + 1;
    }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const n = counts[i] as number;
    out[i * 4] = (sums[i * 4] as number) / n;
    out[i * 4 + 1] = (sums[i * 4 + 1] as number) / n;
    out[i * 4 + 2] = (sums[i * 4 + 2] as number) / n;
    out[i * 4 + 3] = (sums[i * 4 + 3] as number) / n;
  }
  return { data: out, width: w, height: h };
}
