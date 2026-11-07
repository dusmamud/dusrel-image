/** Public types for @dusrel/image-avif (libavif + libaom WASM codec). */

export type AvifPixelFormat = "420" | "444" | "422";

export interface AvifEncodeOptions {
  /** 0..100. Default 50. */
  quality?: number;
  /** 0..100. Default: same as quality. */
  qualityAlpha?: number;
  /**
   * 0..10 (10 = fastest). Default 9, per docs/CODEC_GUIDE.md: AVIF
   * encoding is expensive, and lower speeds are an explicit choice.
   */
  speed?: number;
  /** Chroma format. Default '420'; '444' keeps full chroma (and enables near-lossless at quality 100). */
  pixelFormat?: AvifPixelFormat;
}

export interface ResolvedAvifEncodeOptions {
  quality: number;
  qualityAlpha: number;
  speed: number;
  pixelFormat: AvifPixelFormat;
}

/** Explicit codec asset locations (CDN hosting / tests). */
export interface CodecAssets {
  encodeJsUrl?: string;
  encodeWasmUrl?: string;
  decodeJsUrl?: string;
  decodeWasmUrl?: string;
}
