/** Public types for @dusrel/image-resize (Rust `resize` crate, WASM). */

export type ResizeFilter =
  | "nearest"
  | "triangle"
  | "catmull-rom"
  | "mitchell"
  | "bspline"
  | "gaussian"
  | "lanczos3";

export interface ResizeOptions {
  /** Target width in pixels (positive integer). */
  width: number;
  /** Target height in pixels (positive integer). */
  height: number;
  /**
   * Resampling filter. Default 'lanczos3' (the high-quality default,
   * especially for downscaling). 'nearest' for pixel art.
   */
  filter?: ResizeFilter;
  /**
   * Alpha handling. 'premultiplied' (default) resamples in
   * premultiplied space — the mathematically correct path that stops
   * transparent pixels' colours bleeding into visible edges.
   * 'straight' resamples raw channels (for data/masks, not photos).
   */
  alpha?: "premultiplied" | "straight";
}

export interface ResolvedResizeOptions {
  width: number;
  height: number;
  filter: ResizeFilter;
  alpha: "premultiplied" | "straight";
}

/** Explicit codec asset locations (CDN hosting / tests). */
export interface CodecAssets {
  jsUrl?: string;
  wasmUrl?: string;
}
