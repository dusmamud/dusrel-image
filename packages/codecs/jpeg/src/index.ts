/**
 * @dusrel/image-jpeg
 *
 * MozJPEG codec (WASM, lazy-loaded). Separate encode/decode entries.
 * The WASM artifacts live in this package's `codec/` folder and are
 * built reproducibly from mozilla/mozjpeg v4.1.5 (see native/mozjpeg).
 */
export { encode, initEncode, resolveEncodeOptions } from "./encode.js";
export { decode, initDecode } from "./decode.js";
export { setCodecAssets } from "./module.js";
export type { CodecAssets, MozJpegEncodeOptions, ResolvedEncodeOptions } from "./types.js";
