/** Public types for @dusrel/image-oxipng (Rust `oxipng` crate, WASM). */

export type OxipngStrip = "none" | "safe" | "all";
export type OxipngInterlace = "keep" | "off" | "on";

export interface OxipngOptions {
  /** Optimisation preset 0..6 (oxipng's own scale). Default 2. Higher = slower, smaller. */
  level?: number;
  /**
   * Chunk stripping. 'safe' removes chunks that do not affect how the
   * image displays; 'all' removes every non-critical chunk. Default 'safe'.
   */
  strip?: OxipngStrip;
  /**
   * Interlacing control. Default 'keep' — note oxipng's own presets
   * de-interlace by default; this package preserves the input's
   * structure unless you ask otherwise.
   */
  interlace?: OxipngInterlace;
  /** Return output even when it is not smaller than the input. Default false. */
  force?: boolean;
}

export interface ResolvedOxipngOptions {
  level: number;
  strip: OxipngStrip;
  interlace: OxipngInterlace;
  force: boolean;
}

/** Explicit codec asset locations (CDN hosting / tests). */
export interface CodecAssets {
  jsUrl?: string;
  wasmUrl?: string;
}
