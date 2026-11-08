/** Public types for @dusrel/image-gif (Rust `gif` crate, WASM). */

/** Explicit codec asset locations (CDN hosting / tests). */
export interface CodecAssets {
  jsUrl?: string;
  wasmUrl?: string;
}

/** One frame to encode: pixels plus an optional display duration. */
export interface GifFrameInput {
  data: ImageData;
  /** Frame delay in milliseconds (rounded to the GIF format's native 10 ms unit). Default 100. */
  delay?: number;
}

export interface GifEncodeOptions {
  /**
   * Loop count, gif.js semantics: 0 = loop forever (default),
   * -1 = no loop block (plays once), n = loop n more times.
   */
  repeat?: number;
  /**
   * Colour-quantisation sampling speed 1..30 (the gif crate's
   * NeuQuant `speed`): 1 = best quality / slowest, 30 = fastest.
   * Default 10.
   */
  speed?: number;
  /**
   * "per-frame" (default): every frame gets its own palette.
   * "global": one palette sampled from ALL frames is shared —
   * smaller files for multi-frame GIFs whose frames share colours.
   */
  palette?: "per-frame" | "global";
}

export interface ResolvedGifEncodeOptions {
  repeat: number;
  speed: number;
  palette: "per-frame" | "global";
}

/** One decoded frame: composited full-canvas pixels plus its delay. */
export interface GifFrame {
  data: ImageData;
  /** Frame delay in milliseconds. */
  delay: number;
}

export interface DecodedGif {
  width: number;
  height: number;
  /** 0 = forever, -1 = no loop block (plays once), n = loop n more times. */
  repeat: number;
  frames: GifFrame[];
}

/** Optimisation options: encode options plus an optional new default delay. */
export interface GifOptimizeOptions extends GifEncodeOptions {
  /** Replace every frame's delay (ms). Default: keep each frame's own delay. */
  delay?: number;
}
