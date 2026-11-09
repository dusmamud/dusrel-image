import { loadModule, setCodecAssets, type EmscriptenCodecModule } from "./module.js";
import type { CodecAssets, JxlEncodeOptions, ResolvedJxlEncodeOptions } from "./types.js";

/** Applies defaults and validates encode options (pure; unit tested). */
export function resolveEncodeOptions(options: JxlEncodeOptions = {}): ResolvedJxlEncodeOptions {
  const quality = options.quality ?? 85;
  if (typeof quality !== "number" || Number.isNaN(quality) || quality < 0 || quality > 100) {
    throw new RangeError(`quality must be a number in 0..100, got ${quality}.`);
  }
  const effort = options.effort ?? 7;
  if (!Number.isInteger(effort) || effort < 1 || effort > 10) {
    throw new RangeError(`effort must be an integer in 1..10, got ${effort}.`);
  }
  return { quality, lossless: options.lossless ?? false, effort };
}

type EncodeFn = (
  rgba: number,
  width: number,
  height: number,
  quality: number,
  effort: number,
  lossless: number,
  outSize: number,
) => number;

let boundEncode: { mod: EmscriptenCodecModule; fn: EncodeFn } | undefined;

async function getEncodeFn(): Promise<{ mod: EmscriptenCodecModule; fn: EncodeFn }> {
  const mod = await loadModule("enc");
  // The cwrap'd function belongs to one module instance. setCodecAssets
  // clears the module cache, so a later load can return a different
  // instance — rebind whenever the instance changes, otherwise the old
  // instance's function would be called with the new module's pointers
  // (which silently produced empty output before this fix).
  if (!boundEncode || boundEncode.mod !== mod) {
    boundEncode = {
      mod,
      fn: mod.cwrap("dusrel_jxl_encode", "number", [
        "number",
        "number",
        "number",
        "number",
        "number",
        "number",
        "number",
      ]) as EncodeFn,
    };
  }
  return boundEncode;
}

/** Loads and instantiates the encoder WASM ahead of first use. */
export async function initEncode(assetOverrides?: CodecAssets): Promise<void> {
  if (assetOverrides) setCodecAssets(assetOverrides);
  await loadModule("enc");
}

/** Encodes raw RGBA pixels (an ImageData) into a bare JPEG XL codestream with libjxl. */
export async function encode(
  data: ImageData,
  options: JxlEncodeOptions = {},
): Promise<ArrayBuffer> {
  const { quality, lossless, effort } = resolveEncodeOptions(options);
  const expected = data.width * data.height * 4;
  if (data.data.length !== expected) {
    throw new RangeError(
      `ImageData length ${data.data.length} does not match ${data.width}x${data.height} RGBA (${expected}).`,
    );
  }
  const { mod, fn } = await getEncodeFn();
  const inPtr = mod._malloc(data.data.length);
  const sizePtr = mod._malloc(4);
  try {
    mod.HEAPU8.set(data.data, inPtr);
    const outPtr = fn(inPtr, data.width, data.height, quality, effort, lossless ? 1 : 0, sizePtr);
    if (outPtr === 0) {
      throw new Error(
        `libjxl encode failed (glue step ${mod._dusrel_jxl_last_step()}; see native/jxl for the step table).`,
      );
    }
    try {
      const size = mod.HEAPU32[sizePtr >> 2] as number;
      const bytes = mod.HEAPU8.slice(outPtr, outPtr + size);
      return bytes.buffer as ArrayBuffer;
    } finally {
      mod._free(outPtr);
    }
  } finally {
    mod._free(inPtr);
    mod._free(sizePtr);
  }
}
