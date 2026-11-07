/**
 * Pure geometry planning for the Canvas pipeline.
 *
 * Everything here is deterministic and DOM-free so it can be unit tested
 * in Node: given a source size and options, compute the crop rectangle,
 * the rotated bounding box and the final output size.
 */
import { DusrelImageError } from "./errors.js";
import type { Rect, ResizeOptions } from "./types.js";

export interface Dimensions {
  width: number;
  height: number;
}

/** Normalises any degree value into [0, 360). */
export function normalizeRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    throw new DusrelImageError(
      "invalid-options",
      `rotate must be a finite number, got ${degrees}.`,
    );
  }
  return ((degrees % 360) + 360) % 360;
}

/** Bounding box of a `w` x `h` rectangle after rotation by `degrees`. */
export function rotatedDimensions(width: number, height: number, degrees: number): Dimensions {
  const rad = (normalizeRotation(degrees) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: Math.max(1, Math.round(width * cos + height * sin)),
    height: Math.max(1, Math.round(width * sin + height * cos)),
  };
}

/** Validates a crop rectangle against the source and returns it unchanged. */
export function validateCrop(source: Dimensions, crop: Rect): Rect {
  const { x, y, width, height } = crop;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    x < 0 ||
    y < 0 ||
    width < 1 ||
    height < 1 ||
    x + width > source.width ||
    y + height > source.height
  ) {
    throw new DusrelImageError(
      "invalid-options",
      `crop {x:${x}, y:${y}, width:${width}, height:${height}} does not lie inside the ${source.width}x${source.height} source.`,
    );
  }
  return { x, y, width, height };
}

/** Output size after applying `resize` to a source of the given size. */
export function resizedDimensions(source: Dimensions, resize: ResizeOptions): Dimensions {
  const { width, height, fit = "inside" } = resize;
  if (width === undefined && height === undefined) {
    throw new DusrelImageError(
      "invalid-options",
      "resize requires at least one of width or height.",
    );
  }
  for (const [name, value] of [
    ["width", width],
    ["height", height],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 1)) {
      throw new DusrelImageError(
        "invalid-options",
        `resize.${name} must be a positive number, got ${value}.`,
      );
    }
  }
  if ((fit === "cover" || fit === "fill") && (width === undefined || height === undefined)) {
    throw new DusrelImageError(
      "invalid-options",
      `resize fit "${fit}" requires both width and height.`,
    );
  }
  if (fit === "fill") {
    return { width: Math.round(width as number), height: Math.round(height as number) };
  }
  const scaleX = width === undefined ? Infinity : width / source.width;
  const scaleY = height === undefined ? Infinity : height / source.height;
  const scale = fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  if (fit === "cover") {
    return { width: Math.round(width as number), height: Math.round(height as number) };
  }
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}

export interface TransformPlan {
  /** Effective crop in source pixels (full frame when no crop was given). */
  crop: Rect;
  /** Size after crop, before rotation. */
  croppedSize: Dimensions;
  /** Bounding box after rotation, before resize. */
  rotatedSize: Dimensions;
  /** Final output size. */
  outputSize: Dimensions;
  /** Normalised rotation in degrees. */
  rotation: number;
}

export function planTransform(
  source: Dimensions,
  options: { crop?: Rect; rotate?: number; resize?: ResizeOptions },
): TransformPlan {
  const crop = options.crop
    ? validateCrop(source, options.crop)
    : { x: 0, y: 0, width: source.width, height: source.height };
  const croppedSize = { width: crop.width, height: crop.height };
  const rotation = normalizeRotation(options.rotate ?? 0);
  const rotatedSize = rotatedDimensions(croppedSize.width, croppedSize.height, rotation);
  const outputSize = options.resize ? resizedDimensions(rotatedSize, options.resize) : rotatedSize;
  return { crop, croppedSize, rotatedSize, outputSize, rotation };
}
