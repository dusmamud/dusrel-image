/** Public types for @dusrel/image-webp (libwebp WASM codec). */

export interface WebPEncodeOptions {
  /** 0..100. Default 80. Ignored when `lossless` is true. */
  quality?: number;
  /** Lossless encoding. Default false. */
  lossless?: boolean;
  /** Effort 0..6 (libwebp `method`): higher is slower and smaller. Default 4. */
  effort?: number;
  /** Alpha-channel quality 0..100. Default 100. */
  alphaQuality?: number;
}

export interface ResolvedWebPEncodeOptions {
  quality: number;
  lossless: boolean;
  effort: number;
  alphaQuality: number;
}

/** Explicit codec asset locations (CDN hosting / tests). See the JPEG package for the pattern. */
export interface CodecAssets {
  encodeJsUrl?: string;
  encodeWasmUrl?: string;
  decodeJsUrl?: string;
  decodeWasmUrl?: string;
}
