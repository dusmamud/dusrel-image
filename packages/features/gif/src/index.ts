/**
 * @dusrel/image-gif
 *
 * GIF encode / decode / optimise (Rust `gif` crate, WASM,
 * lazy-loaded). Animated GIFs included. The engine is the
 * permissive replacement for gifsicle (GPL-2.0), dropped on
 * licence grounds 2026-11-07 — this package stays MIT.
 *
 * The WASM artifact lives in this package's `codec/` folder and
 * is built reproducibly from native/rust (CODEC=gif).
 */
export { decode } from "./decode.js";
export { delayToCentiseconds, encode, resolveEncodeOptions } from "./encode.js";
export { init, setCodecAssets } from "./module.js";
export { optimize } from "./optimize.js";
export type {
  CodecAssets,
  DecodedGif,
  GifEncodeOptions,
  GifFrame,
  GifFrameInput,
  GifOptimizeOptions,
  ResolvedGifEncodeOptions,
} from "./types.js";
