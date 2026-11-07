import type { PixelData, RgbaColor } from "./types.js";
import { rotateQuarter } from "./pixels.js";

/**
 * Rotates by an arbitrary angle (degrees, clockwise) using the
 * platform canvas — the same engine @dusrel/image-core uses, here
 * exposed for direct ImageData work. The output canvas bounds the
 * rotated image; exposed corners are filled with `background`
 * (default transparent). Browser/worker only (needs a 2D canvas);
 * for exact multiples of 90 degrees prefer the lossless
 * rotateQuarter() pixel permutation.
 */
export function rotateArbitrary(
  pixels: PixelData,
  degrees: number,
  background?: RgbaColor,
): PixelData {
  if (!Number.isFinite(degrees)) {
    throw new RangeError(`degrees must be finite, got ${String(degrees)}.`);
  }
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized % 90 === 0) {
    // Exact path — no resampling.
    return rotateQuarter(pixels, normalized / 90);
  }
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error(
      "rotateArbitrary needs OffscreenCanvas in this environment; use rotateQuarter for 90-degree steps.",
    );
  }
  const radians = (normalized * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  // Ceil, not round: the output bounds must CONTAIN the rotated
  // image — rounding 21.21 down to 21 would clip the corners.
  const outW = Math.max(1, Math.ceil(pixels.width * cos + pixels.height * sin));
  const outH = Math.max(1, Math.ceil(pixels.width * sin + pixels.height * cos));

  const src = new OffscreenCanvas(pixels.width, pixels.height);
  const srcCtx = src.getContext("2d");
  if (!srcCtx) throw new Error("2d context unavailable for rotation.");
  srcCtx.putImageData(
    new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height),
    0,
    0,
  );

  const out = new OffscreenCanvas(outW, outH);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable for rotation.");
  if (background) {
    const a = (background.a ?? 255) / 255;
    ctx.fillStyle = `rgba(${background.r}, ${background.g}, ${background.b}, ${a})`;
    ctx.fillRect(0, 0, outW, outH);
  }
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(radians);
  ctx.drawImage(src, -pixels.width / 2, -pixels.height / 2);
  const result = ctx.getImageData(0, 0, outW, outH);
  return { data: result.data, width: result.width, height: result.height };
}
