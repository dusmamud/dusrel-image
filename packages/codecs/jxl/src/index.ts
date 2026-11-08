/**
 * @dusrel/image-jxl
 *
 * JPEG XL codec (libjxl, WASM, lazy-loaded). Separate encode/decode
 * entries. The WASM artifacts live in this package's `codec/` folder
 * and are built reproducibly from libjxl v0.11.2 (see native/jxl).
 *
 * EXPERIMENTAL: browser JPEG XL decode support is still limited;
 * use only where you control the viewing environment.
 * Single-threaded by construction (ADR-0006): no SharedArrayBuffer
 * or COOP/COEP requirement.
 */
export { encode, initEncode, resolveEncodeOptions } from "./encode.js";
export { decode, initDecode } from "./decode.js";
export { setCodecAssets } from "./module.js";
export type { CodecAssets, JxlEncodeOptions, ResolvedJxlEncodeOptions } from "./types.js";
