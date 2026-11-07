/**
 * @dusrel/image-oxipng
 *
 * Lossless PNG optimisation via the Rust `oxipng` crate (WASM,
 * lazy-loaded): oxipng preset levels 0..6, metadata chunk stripping
 * and the Adam7 interlace control the png crate's encoder lacks.
 * Pixels are never changed — only the encoding gets smaller.
 */
export { init, optimize, resolveOptions } from "./optimize.js";
export { setCodecAssets } from "./module.js";
export type {
  CodecAssets,
  OxipngInterlace,
  OxipngOptions,
  OxipngStrip,
  ResolvedOxipngOptions,
} from "./types.js";
