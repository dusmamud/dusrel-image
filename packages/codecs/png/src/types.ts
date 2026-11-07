/** Public types for @dusrel/image-png (Rust `png` crate, WASM). */

export type PngCompression = "fast" | "default" | "best";
export type PngFilter = "none" | "sub" | "up" | "avg" | "paeth" | "adaptive";

export interface PngEncodeOptions {
  /** DEFLATE effort trade-off. Default 'default'. (PNG is lossless — this never changes pixels.) */
  compression?: PngCompression;
  /** Row filter strategy. Default 'adaptive' (per-row best, like libpng). */
  filter?: PngFilter;
  // Note: no interlace option here — the Rust png crate cannot
  // encode Adam7. Interlace control lives in @dusrel/image-oxipng,
  // exactly as docs/CODEC_GUIDE.md assigns it.
}

export interface ResolvedPngEncodeOptions {
  compression: PngCompression;
  filter: PngFilter;
}

/** Explicit codec asset locations (CDN hosting / tests). */
export interface CodecAssets {
  encodeJsUrl?: string;
  encodeWasmUrl?: string;
  decodeJsUrl?: string;
  decodeWasmUrl?: string;
}
