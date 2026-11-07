/**
 * @dusrel/image-adjust
 *
 * Colour and tone adjustments for the @dusrel/image family, on the
 * structural PixelData every feature package shares: a one-pass
 * point pipeline (exposure, brightness, contrast, gamma,
 * hue-rotate, saturation, grayscale, sepia, invert — in that
 * documented order) plus convolution sharpening and fast box /
 * gaussian-approximate blurs. Pure functions: they run anywhere,
 * and slot into @dusrel/image's imageDataPlugin unchanged.
 */
export {
  adjust,
  brightness,
  contrast,
  grayscale,
  invert,
  resolveAdjustOptions,
  saturation,
  sepia,
  type ResolvedAdjustOptions,
} from "./adjust.js";
export { boxBlur, convolve3x3, gaussianBlur, sharpen } from "./convolve.js";
export type { AdjustOptions, PixelData } from "./types.js";
