/**
 * @dusrel/image-quantize
 *
 * Colour quantization via the Rust `quantizr` crate (WASM,
 * lazy-loaded): reduce an image to a palette of at most 256
 * colours plus per-pixel indices — the preparation step behind
 * small palette PNGs. The engine is MIT-licensed quantizr,
 * chosen to replace GPL libimagequant so this package stays MIT
 * (docs/adr/0003 addendum).
 */
export {
  init,
  quantize,
  quantizeToImageData,
  resolveOptions,
  resultToImageData,
} from "./quantize.js";
export { setCodecAssets } from "./module.js";
export type {
  CodecAssets,
  QuantizeOptions,
  QuantizeResult,
  ResolvedQuantizeOptions,
} from "./types.js";
