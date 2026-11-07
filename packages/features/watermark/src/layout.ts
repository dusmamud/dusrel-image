import type { Placement, ResolvedWatermarkOptions, WatermarkOptions } from "./types.js";

export function resolveWatermarkOptions(options: WatermarkOptions = {}): ResolvedWatermarkOptions {
  const opacity = options.opacity ?? 0.7;
  if (typeof opacity !== "number" || !(opacity >= 0 && opacity <= 1)) {
    throw new RangeError(`opacity must be between 0 and 1, got ${String(opacity)}.`);
  }
  const scale = options.scale ?? 0.2;
  if (typeof scale !== "number" || !(scale > 0 && scale <= 1)) {
    throw new RangeError(`scale must be in (0, 1], got ${String(scale)}.`);
  }
  const margin = options.margin ?? 16;
  if (typeof margin !== "number" || !(margin >= 0)) {
    throw new RangeError(`margin must be >= 0, got ${String(margin)}.`);
  }
  const position = options.position ?? "bottom-right";
  const valid = ["top-left", "top-right", "bottom-left", "bottom-right", "center", "tile"];
  if (!valid.includes(position)) {
    throw new RangeError(`position must be one of ${valid.join(", ")}, got ${String(position)}.`);
  }
  return {
    position,
    opacity,
    scale,
    margin,
    tileGap: options.tileGap,
    font: options.font ?? "600 24px sans-serif",
    color: options.color ?? "#ffffff",
  };
}

/**
 * Computes where the mark goes. Pure geometry — the heart of the
 * package, shared by the pixel compositor and the canvas text
 * path. Mark size derives from `scale` (width fraction) and the
 * mark's aspect ratio.
 */
export function placementsFor(
  imageWidth: number,
  imageHeight: number,
  markAspect: number,
  options: ResolvedWatermarkOptions,
): Placement[] {
  if (!(markAspect > 0))
    throw new RangeError(`markAspect must be positive, got ${String(markAspect)}.`);
  const width = Math.max(1, Math.round(imageWidth * options.scale));
  const height = Math.max(1, Math.round(width / markAspect));
  const m = options.margin;
  switch (options.position) {
    case "top-left":
      return [{ x: m, y: m, width, height }];
    case "top-right":
      return [{ x: imageWidth - width - m, y: m, width, height }];
    case "bottom-left":
      return [{ x: m, y: imageHeight - height - m, width, height }];
    case "bottom-right":
      return [{ x: imageWidth - width - m, y: imageHeight - height - m, width, height }];
    case "center":
      return [
        {
          x: Math.round((imageWidth - width) / 2),
          y: Math.round((imageHeight - height) / 2),
          width,
          height,
        },
      ];
    case "tile": {
      const gap = options.tileGap ?? width;
      const placements: Placement[] = [];
      for (let y = m; y + height <= imageHeight - m + height; y += height + gap) {
        for (let x = m; x + width <= imageWidth - m + width; x += width + gap) {
          if (x + width > imageWidth || y + height > imageHeight) continue;
          placements.push({ x, y, width, height });
        }
      }
      return placements;
    }
  }
}
