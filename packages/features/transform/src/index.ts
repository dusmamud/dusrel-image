/**
 * @dusrel/image-transform
 *
 * Pixel-exact transforms for the @dusrel/image family: flips and
 * quarter-turn rotations are pure permutations (no resampling, no
 * quality loss), arbitrary-angle rotation uses the platform
 * canvas, background fill composites over a colour, and the
 * perspective helpers compute and apply true homographies on the
 * CPU. Everything works on a structural PixelData ({ data, width,
 * height }) so it runs in workers, tests and any JS runtime, and
 * drops straight into @dusrel/image's imageDataPlugin.
 */
export { fillBackground, flipHorizontal, flipVertical, rotateQuarter } from "./pixels.js";
export { rotateArbitrary } from "./rotate.js";
export {
  applyMatrix,
  invertMatrix,
  perspectiveMatrix,
  warpPerspective,
  type WarpOptions,
} from "./perspective.js";
export type { PixelData, Point, Quad, RgbaColor } from "./types.js";
