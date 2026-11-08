/**
 * Structural pixel container — exactly the shape of the DOM
 * ImageData, declared structurally so the pure functions in this
 * package run (and are unit-tested) anywhere, DOM or not.
 */
export interface PixelData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** An RGBA colour with 0..255 integer channels. */
export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ThumbHashEncodeOptions {
  /**
   * Encoders shrink the input before hashing (the algorithms
   * discard fine detail anyway). The input is box-averaged down
   * so both dimensions fit this many pixels, preserving aspect.
   * ThumbHash's format caps at 100; larger values are clamped.
   * Default 100.
   */
  maxSize?: number;
}

export interface BlurHashEncodeOptions {
  /** DCT components across, 1..9. Default 4. */
  componentX?: number;
  /** DCT components down, 1..9. Default 3. */
  componentY?: number;
  /**
   * The input is box-averaged down so both dimensions fit this
   * many pixels before encoding. Default 128. Pass Infinity to
   * encode at full size (slow for large photos).
   */
  maxSize?: number;
}

export interface BlurHashDecodeOptions {
  /**
   * Scales the AC (detail) terms while decoding. 1 is the
   * faithful decode; higher values look more saturated/sharp.
   * Default 1.
   */
  punch?: number;
}
