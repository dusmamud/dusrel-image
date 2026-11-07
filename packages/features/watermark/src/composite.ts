import { placementsFor, resolveWatermarkOptions } from "./layout.js";
import type { PixelData, Placement, WatermarkOptions } from "./types.js";

function assertPixels(pixels: PixelData, name: string): void {
  if (pixels.data.length !== pixels.width * pixels.height * 4) {
    throw new RangeError(`${name} length does not match its dimensions.`);
  }
}

/** Bilinear resample (used to scale the mark; solid colours stay solid). */
export function scalePixels(pixels: PixelData, width: number, height: number): PixelData {
  assertPixels(pixels, "mark");
  if (width === pixels.width && height === pixels.height) {
    return { data: new Uint8ClampedArray(pixels.data), width, height };
  }
  const out: PixelData = { data: new Uint8ClampedArray(width * height * 4), width, height };
  const sx = pixels.width / width;
  const sy = pixels.height / height;
  for (let y = 0; y < height; y++) {
    const srcY = Math.min(pixels.height - 1, (y + 0.5) * sy - 0.5);
    const y0 = Math.max(0, Math.floor(srcY));
    const y1 = Math.min(pixels.height - 1, y0 + 1);
    const fy = Math.min(1, Math.max(0, srcY - y0));
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(pixels.width - 1, (x + 0.5) * sx - 0.5);
      const x0 = Math.max(0, Math.floor(srcX));
      const x1 = Math.min(pixels.width - 1, x0 + 1);
      const fx = Math.min(1, Math.max(0, srcX - x0));
      const dst = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top =
          pixels.data[(y0 * pixels.width + x0) * 4 + c]! * (1 - fx) +
          pixels.data[(y0 * pixels.width + x1) * 4 + c]! * fx;
        const bottom =
          pixels.data[(y1 * pixels.width + x0) * 4 + c]! * (1 - fx) +
          pixels.data[(y1 * pixels.width + x1) * 4 + c]! * fx;
        out.data[dst + c] = top * (1 - fy) + bottom * fy;
      }
    }
  }
  return out;
}

/** Source-over composites one already-scaled mark at one placement, with global opacity. Mutates `base`. */
export function compositeOne(
  base: PixelData,
  mark: PixelData,
  placement: Placement,
  opacity: number,
): void {
  for (let y = 0; y < mark.height; y++) {
    const by = placement.y + y;
    if (by < 0 || by >= base.height) continue;
    for (let x = 0; x < mark.width; x++) {
      const bx = placement.x + x;
      if (bx < 0 || bx >= base.width) continue;
      const s = (y * mark.width + x) * 4;
      const d = (by * base.width + bx) * 4;
      const sa = (mark.data[s + 3]! / 255) * opacity;
      if (sa === 0) continue;
      const da = base.data[d + 3]! / 255;
      const outA = sa + da * (1 - sa);
      if (outA === 0) {
        base.data[d + 3] = 0;
        continue;
      }
      for (let c = 0; c < 3; c++) {
        base.data[d + c] = (mark.data[s + c]! * sa + base.data[d + c]! * da * (1 - sa)) / outA;
      }
      base.data[d + 3] = outA * 255;
    }
  }
}

/**
 * Applies an image watermark: scales the mark (aspect preserved),
 * positions or tiles it, and composites with the requested
 * opacity. Pure — returns a new PixelData; runs anywhere.
 */
export function applyWatermark(
  image: PixelData,
  mark: PixelData,
  options: WatermarkOptions = {},
): PixelData {
  assertPixels(image, "image");
  assertPixels(mark, "mark");
  const resolved = resolveWatermarkOptions(options);
  const out: PixelData = {
    data: new Uint8ClampedArray(image.data),
    width: image.width,
    height: image.height,
  };
  const placements = placementsFor(image.width, image.height, mark.width / mark.height, resolved);
  for (const placement of placements) {
    const scaled = scalePixels(mark, placement.width, placement.height);
    compositeOne(out, scaled, placement, resolved.opacity);
  }
  return out;
}
