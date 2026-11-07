/**
 * @dusrel/image-webp
 *
 * libwebp codec (WASM, lazy-loaded). Separate encode/decode entries.
 * The WASM artifacts live in this package's `codec/` folder and are
 * built reproducibly from webmproject/libwebp v1.6.0 (see native/webp).
 */
export { encode, initEncode, resolveEncodeOptions } from "./encode.js";
export { decode, initDecode } from "./decode.js";
export { setCodecAssets } from "./module.js";
export type { CodecAssets, ResolvedWebPEncodeOptions, WebPEncodeOptions } from "./types.js";
