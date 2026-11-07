/**
 * @dusrel/image-avif
 *
 * libavif + libaom codec (WASM, lazy-loaded). Separate encode/decode
 * entries. The WASM artifacts live in this package's `codec/` folder
 * and are built reproducibly (see native/avif: libaom v3.12.1,
 * libavif v1.4.2, emsdk 3.1.66). Single-threaded by default — the
 * threaded encoder stays opt-in (cross-origin isolation required).
 */
export { encode, initEncode, resolveEncodeOptions } from "./encode.js";
export { decode, initDecode } from "./decode.js";
export { setCodecAssets } from "./module.js";
export type {
  AvifEncodeOptions,
  AvifPixelFormat,
  CodecAssets,
  ResolvedAvifEncodeOptions,
} from "./types.js";
