/** Public types for @dusrel/image-jxl (libjxl WASM codec). */

export interface JxlEncodeOptions {
  /**
   * 0..100, mapped to a butteraugli distance by libjxl's own
   * JxlEncoderDistanceFromQuality. Default 85. Ignored when
   * `lossless` is true.
   */
  quality?: number;
  /** Mathematically lossless (modular) encoding. Default false. */
  lossless?: boolean;
  /** Effort 1..10: higher is slower and smaller. Default 7. */
  effort?: number;
}

export interface ResolvedJxlEncodeOptions {
  quality: number;
  lossless: boolean;
  effort: number;
}

/** Explicit codec asset locations (CDN hosting / tests). See the WebP package for the pattern. */
export interface CodecAssets {
  encodeJsUrl?: string;
  encodeWasmUrl?: string;
  decodeJsUrl?: string;
  decodeWasmUrl?: string;
}
