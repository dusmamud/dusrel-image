import { assertPixelData } from "./internal.js";
import type { PixelData, RgbaColor } from "./types.js";

export type {
  BlurHashDecodeOptions,
  BlurHashEncodeOptions,
  PixelData,
  RgbaColor,
  ThumbHashEncodeOptions,
} from "./types.js";
export { blurHashComponents, decodeBlurHash, encodeBlurHash, isValidBlurHash } from "./blurhash.js";
export {
  decodeThumbHash,
  encodeThumbHash,
  thumbHashAspectRatio,
  thumbHashAverageColor,
  thumbHashFromBase64,
  thumbHashToBase64,
} from "./thumbhash.js";

/**
 * The plain per-channel average colour of an image (0..255,
 * rounded) — the zero-decoding placeholder: paint this colour
 * while the real image loads. For a smarter average that
 * matches a stored ThumbHash, see thumbHashAverageColor.
 */
export function averageColor(input: PixelData): RgbaColor {
  assertPixelData(input);
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  const { data, width, height } = input;
  const count = width * height;
  for (let i = 0; i < count; i++) {
    r += data[i * 4] as number;
    g += data[i * 4 + 1] as number;
    b += data[i * 4 + 2] as number;
    a += data[i * 4 + 3] as number;
  }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
    a: Math.round(a / count),
  };
}
