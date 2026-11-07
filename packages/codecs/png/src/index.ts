/**
 * @dusrel/image-png
 *
 * PNG codec via the Rust `png` crate (WASM, lazy-loaded). Separate
 * encode/decode entries, each built from the same crate with a
 * different cargo feature (see native/rust). Lossless: the encode
 * options trade CPU and size, never pixels.
 */
export { encode, initEncode, resolveEncodeOptions } from "./encode.js";
export { decode, initDecode } from "./decode.js";
export { setCodecAssets } from "./module.js";
export type {
  CodecAssets,
  PngCompression,
  PngEncodeOptions,
  PngFilter,
  ResolvedPngEncodeOptions,
} from "./types.js";
