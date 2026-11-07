/**
 * Pure crop geometry in NATURAL image pixels — the same
 * { x, y, width, height } shape @dusrel/image-core's crop option
 * takes, so the UI's output drops straight into the pipeline.
 * Every function here is unit-tested in Node; the Web Component
 * is a thin interactive shell over this maths.
 */

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type CropShape = "rect" | "circle";

export interface CropConstraints {
  /** Width / height ratio lock. Ignored when shape is 'circle' (always 1). */
  aspect?: number;
  shape?: CropShape;
  minWidth?: number;
  minHeight?: number;
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export function effectiveAspect(constraints: CropConstraints = {}): number | undefined {
  if (constraints.shape === "circle") return 1;
  const aspect = constraints.aspect;
  if (aspect !== undefined && (!(aspect > 0) || !Number.isFinite(aspect))) {
    throw new RangeError(`aspect must be a positive finite number, got ${String(aspect)}.`);
  }
  return aspect;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Clamps a crop rect into the image, enforcing min sizes and the
 * aspect lock. Output is integer pixels. Bounds always win over
 * min sizes (a 100 px image cannot honour a 200 px minimum).
 */
export function clampCrop(
  rect: CropRect,
  image: Size,
  constraints: CropConstraints = {},
): CropRect {
  const aspect = effectiveAspect(constraints);
  const minW = Math.min(constraints.minWidth ?? 1, image.width);
  const minH = Math.min(constraints.minHeight ?? 1, image.height);
  let width = clamp(rect.width, minW, image.width);
  let height: number;
  if (aspect) {
    height = width / aspect;
    if (height > image.height) {
      height = image.height;
      width = height * aspect;
    }
    if (height < minH) {
      height = minH;
      width = height * aspect;
      if (width > image.width) {
        width = image.width;
        height = width / aspect;
      }
    }
  } else {
    height = clamp(rect.height, minH, image.height);
  }
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  return {
    x: Math.round(clamp(rect.x, 0, Math.max(0, image.width - width))),
    y: Math.round(clamp(rect.y, 0, Math.max(0, image.height - height))),
    width,
    height,
  };
}

/** The starting crop: centred, covering `coverage` of the image, aspect-aware. */
export function initialCrop(
  image: Size,
  constraints: CropConstraints & { coverage?: number } = {},
): CropRect {
  const coverage = constraints.coverage ?? 0.8;
  if (!(coverage > 0 && coverage <= 1)) {
    throw new RangeError(`coverage must be in (0, 1], got ${String(coverage)}.`);
  }
  const aspect = effectiveAspect(constraints);
  const boxW = image.width * coverage;
  const boxH = image.height * coverage;
  let width = boxW;
  let height = boxH;
  if (aspect) {
    width = Math.min(boxW, boxH * aspect);
    height = width / aspect;
  }
  return clampCrop(
    { x: (image.width - width) / 2, y: (image.height - height) / 2, width, height },
    image,
    constraints,
  );
}

/** Translates a crop (natural px deltas), clamped into the image. */
export function moveCrop(
  rect: CropRect,
  dx: number,
  dy: number,
  image: Size,
  constraints: CropConstraints = {},
): CropRect {
  return clampCrop({ ...rect, x: rect.x + dx, y: rect.y + dy }, image, constraints);
}

/**
 * Resizes by dragging one handle by (dx, dy) natural px. With an
 * aspect lock, corner drags are driven by the axis with the
 * larger relative change, and edge drags keep the rect centred on
 * the perpendicular axis. The opposite side stays anchored as far
 * as the image bounds allow (bounds win — see clampCrop).
 */
export function resizeCrop(
  rect: CropRect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  image: Size,
  constraints: CropConstraints = {},
): CropRect {
  const aspect = effectiveAspect(constraints);
  let { x, y, width, height } = rect;
  const right = x + width;
  const bottom = y + height;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");
  const isCorner = (west || east) && (north || south);

  if (east) width += dx;
  if (west) {
    x += dx;
    width -= dx;
  }
  if (south) height += dy;
  if (north) {
    y += dy;
    height -= dy;
  }

  if (aspect) {
    if (isCorner) {
      // Drive by the axis with the larger relative change.
      const wDriven =
        Math.abs(width - rect.width) / rect.width >= Math.abs(height - rect.height) / rect.height;
      if (wDriven) {
        height = width / aspect;
      } else {
        width = height * aspect;
      }
      // Re-anchor: the opposite corner stays fixed.
      if (west) x = right - width;
      if (north) y = bottom - height;
    } else if (east || west) {
      height = width / aspect;
      y = centerY - height / 2;
      if (west) x = right - width;
    } else {
      width = height * aspect;
      x = centerX - width / 2;
      if (north) y = bottom - height;
    }
  }
  return clampCrop({ x, y, width, height }, image, constraints);
}

/** Contain-fit of a natural size into a display box, centred. */
export function fitRect(
  natural: Size,
  box: Size,
): { x: number; y: number; width: number; height: number; scale: number } {
  const scale = Math.min(box.width / natural.width, box.height / natural.height);
  const width = natural.width * scale;
  const height = natural.height * scale;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height, scale };
}

/** Maps a display-space rect into natural pixels at the given view scale. */
export function displayToNatural(rect: CropRect, scale: number): CropRect {
  return {
    x: Math.round(rect.x / scale),
    y: Math.round(rect.y / scale),
    width: Math.round(rect.width / scale),
    height: Math.round(rect.height / scale),
  };
}

/** Maps a natural-pixel rect into display space at the given view scale. */
export function naturalToDisplay(rect: CropRect, scale: number): CropRect {
  return {
    x: rect.x * scale,
    y: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}
