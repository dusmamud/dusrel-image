/** Public types for @dusrel/image-heic (libheif WASM decoder). */

/** URLs of the codec assets, for self-hosting or CDN overrides. */
export interface CodecAssets {
  jsUrl?: string;
  wasmUrl?: string;
}

export interface HeicDecodeOptions {
  /**
   * Try the browser's native HEIC decoder first (Safari 17+).
   * The probe IS the decode — where native works, no WASM is
   * fetched at all. Default true. Set false to always use the
   * bundled libheif WASM (deterministic across browsers).
   */
  nativeFirst?: boolean;
}
