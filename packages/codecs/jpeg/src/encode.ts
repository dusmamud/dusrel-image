import { loadModule, type EmscriptenCodecModule } from "./module.js";
import type { CodecAssets, MozJpegEncodeOptions, ResolvedEncodeOptions } from "./types.js";
import { setCodecAssets } from "./module.js";

/** Applies defaults and validates encode options (pure; unit tested). */
export function resolveEncodeOptions(options: MozJpegEncodeOptions = {}): ResolvedEncodeOptions {
  const quality = options.quality ?? 75;
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
    throw new RangeError(`quality must be an integer in 1..100, got ${quality}.`);
  }
  const chromaSubsample = options.chromaSubsample ?? 2;
  if (chromaSubsample !== 0 && chromaSubsample !== 1 && chromaSubsample !== 2) {
    throw new RangeError(
      `chromaSubsample must be 0 (4:4:4), 1 (4:2:2) or 2 (4:2:0), got ${chromaSubsample}.`,
    );
  }
  return { quality, progressive: options.progressive ?? true, chromaSubsample };
}

type EncodeFn = (
  rgba: number,
  width: number,
  height: number,
  quality: number,
  progressive: number,
  subsample: number,
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
      fn: mod.cwrap("dusrel_jpeg_encode", "number", [
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

/**
 * Encodes raw RGBA pixels (an ImageData) into a JPEG byte buffer with
 * the MozJPEG encoder.
 */
export async function encode(
  data: ImageData,
  options: MozJpegEncodeOptions = {},
): Promise<ArrayBuffer> {
  const { quality, progressive, chromaSubsample } = resolveEncodeOptions(options);
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
    const outPtr = fn(
      inPtr,
      data.width,
      data.height,
      quality,
      progressive ? 1 : 0,
      chromaSubsample,
      sizePtr,
    );
    if (outPtr === 0) throw new Error("MozJPEG encode failed (the codec returned no output).");
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
