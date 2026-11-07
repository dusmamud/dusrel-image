/** Public types for @dusrel/image-jpeg (MozJPEG WASM codec). */

export interface MozJpegEncodeOptions {
  /** 1..100, MozJPEG scale. Default 75. */
  quality?: number;
  /** Progressive JPEG (multiple scans, smaller on the web). Default true. */
  progressive?: boolean;
  /** Chroma subsampling: 0 = 4:4:4, 1 = 4:2:2, 2 = 4:2:0. Default 2. */
  chromaSubsample?: 0 | 1 | 2;
}

export interface ResolvedEncodeOptions {
  quality: number;
  progressive: boolean;
  chromaSubsample: 0 | 1 | 2;
}

/**
 * Explicit locations of the codec assets. By default the wrapper looks
 * next to the package (the bundled `codec/` assets); pass these to host
 * the (large) WASM files on a CDN, or to load from blob URLs in tests.
 * Set them before the first encode/decode (see `setCodecAssets`).
 */
export interface CodecAssets {
  encodeJsUrl?: string;
  encodeWasmUrl?: string;
  decodeJsUrl?: string;
  decodeWasmUrl?: string;
}
