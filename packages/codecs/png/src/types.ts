/** Public types for @dusrel/image-png (Rust `png` crate, WASM). */

export type PngCompression = "fast" | "default" | "best";
export type PngFilter = "none" | "sub" | "up" | "avg" | "paeth" | "adaptive";

export interface PngEncodeOptions {
  /** DEFLATE effort trade-off. Default 'default'. (PNG is lossless — this never changes pixels.) */
  compression?: PngCompression;
  /** Row filter strategy. Default 'adaptive' (per-row best, like libpng). */
  filter?: PngFilter;
  /** Adam7 interlacing. Default false. */
  interlace?: boolean;
}

export interface ResolvedPngEncodeOptions {
  compression: PngCompression;
  filter: PngFilter;
  interlace: boolean;
}

/** Explicit codec asset locations (CDN hosting / tests). */
export interface CodecAssets {
  encodeJsUrl?: string;
  encodeWasmUrl?: string;
  decodeJsUrl?: string;
  decodeWasmUrl?: string;
}
