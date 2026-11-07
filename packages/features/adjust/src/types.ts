/** Structural pixel container (DOM ImageData's shape; see @dusrel/image-transform). */
export interface PixelData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface AdjustOptions {
  /** Additive brightness, -1..1 (0 = unchanged). */
  brightness?: number;
  /** Contrast factor around mid-grey, -1..1 (0 = unchanged). */
  contrast?: number;
  /** Exposure in stops (EV): each +1 doubles light. -3..3 typical. */
  exposure?: number;
  /** Gamma exponent, > 0 (1 = unchanged). */
  gamma?: number;
  /** Saturation multiplier, -1..1 (0 = unchanged, -1 = greyscale). */
  saturation?: number;
  /** Hue rotation in degrees (any finite number; wraps). */
  hueRotate?: number;
  /** Convert to greyscale (luminance). */
  grayscale?: boolean;
  /** Apply the classic sepia tone. */
  sepia?: boolean;
  /** Invert RGB channels. */
  invert?: boolean;
}
