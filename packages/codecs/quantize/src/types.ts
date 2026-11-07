/** Public types for @dusrel/image-quantize (Rust `quantizr` crate, WASM). */

export interface QuantizeOptions {
  /** Maximum palette colours, 2..256. Default 256. */
  maxColors?: number;
  /** Dithering level 0..1 (0 = none, 1 = full). Default 1. */
  dithering?: number;
}

export interface ResolvedQuantizeOptions {
  maxColors: number;
  dithering: number;
}

/** The result of quantizing: a palette plus one index per pixel. */
export interface QuantizeResult {
  /** Palette colours as RGBA bytes (length = colorCount * 4). */
  palette: Uint8ClampedArray;
  /** One palette index per pixel (length = width * height). */
  indices: Uint8Array;
  /** How many palette entries are actually used (<= maxColors). */
  colorCount: number;
  width: number;
  height: number;
  /** The quantizer's reported mean error for this result (lower = closer). */
  error: number;
}

/** Explicit codec asset locations (CDN hosting / tests). */
export interface CodecAssets {
  jsUrl?: string;
  wasmUrl?: string;
}
