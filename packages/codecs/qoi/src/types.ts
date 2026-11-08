/** Public types for @dusrel/image-qoi (Rust `qoi` crate, WASM). */

/** Explicit codec asset locations (CDN hosting / tests). */
export interface CodecAssets {
  encodeJsUrl?: string;
  encodeWasmUrl?: string;
  decodeJsUrl?: string;
  decodeWasmUrl?: string;
}
