/**
 * @dusrel/image-watermark
 *
 * Image and text watermarks for the @dusrel/image family. The
 * layout maths (position, margins, tiling, scale) is pure and
 * shared: image marks composite at pixel level anywhere
 * (workers, tests), text marks draw through the platform canvas
 * with the same placements. Position, opacity, scale and tiling
 * are all developer-controlled, per the family rule.
 */
export { applyWatermark, compositeOne, scalePixels } from "./composite.js";
export { placementsFor, resolveWatermarkOptions } from "./layout.js";
export { drawTextWatermark } from "./text.js";
export type {
  PixelData,
  Placement,
  ResolvedWatermarkOptions,
  WatermarkOptions,
  WatermarkPosition,
} from "./types.js";
