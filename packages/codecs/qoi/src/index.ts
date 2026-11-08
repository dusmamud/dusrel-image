/**
 * @dusrel/image-qoi
 *
 * QOI ("Quite OK Image") codec via the Rust `qoi` crate (WASM,
 * lazy-loaded). Separate encode/decode entries, each built from
 * the same crate with a different cargo feature (see
 * native/rust). Lossless, extremely fast, tiny modules — a
 * niche format for pipelines that control both ends.
 */
export { encode, initEncode } from "./encode.js";
export { decode, initDecode } from "./decode.js";
export { setCodecAssets } from "./module.js";
export type { CodecAssets } from "./types.js";
