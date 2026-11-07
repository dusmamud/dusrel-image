/**
 * @dusrel/image-resize
 *
 * High-quality image resampling via the Rust `resize` crate (WASM,
 * lazy-loaded) — the same engine family Squoosh/jSquash use, with
 * Lanczos3, Mitchell, Catmull-Rom, Triangle, B-spline, Gaussian
 * and Nearest filters and correct premultiplied-alpha handling.
 * The Canvas fast path in @dusrel/image-core stays the default;
 * this package is the quality path developers opt into.
 */
export { init, resize, resolveOptions } from "./resize.js";
export { setCodecAssets } from "./module.js";
export type { CodecAssets, ResizeFilter, ResizeOptions, ResolvedResizeOptions } from "./types.js";
