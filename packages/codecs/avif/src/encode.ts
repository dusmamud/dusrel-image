import { loadModule, setCodecAssets, type EmscriptenCodecModule } from "./module.js";
import type { AvifEncodeOptions, CodecAssets, ResolvedAvifEncodeOptions } from "./types.js";

const FORMAT_CODE = { "420": 0, "444": 1, "422": 2 } as const;

/** Applies defaults and validates encode options (pure; unit tested). */
export function resolveEncodeOptions(options: AvifEncodeOptions = {}): ResolvedAvifEncodeOptions {
  const quality = options.quality ?? 50;
  if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
    throw new RangeError(`quality must be an integer in 0..100, got ${quality}.`);
  }
  const qualityAlpha = options.qualityAlpha ?? quality;
  if (!Number.isInteger(qualityAlpha) || qualityAlpha < 0 || qualityAlpha > 100) {
    throw new RangeError(`qualityAlpha must be an integer in 0..100, got ${qualityAlpha}.`);
  }
  const speed = options.speed ?? 9;
  if (!Number.isInteger(speed) || speed < 0 || speed > 10) {
    throw new RangeError(`speed must be an integer in 0..10, got ${speed}.`);
  }
  const pixelFormat = options.pixelFormat ?? "420";
  if (pixelFormat !== "420" && pixelFormat !== "444" && pixelFormat !== "422") {
    throw new RangeError(`pixelFormat must be '420', '444' or '422', got ${String(pixelFormat)}.`);
  }
  return { quality, qualityAlpha, speed, pixelFormat };
}

type EncodeFn = (
  rgba: number,
  width: number,
  height: number,
  quality: number,
  qualityAlpha: number,
  speed: number,
  pixelFormat: number,
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
      fn: mod.cwrap("dusrel_avif_encode", "number", [
        "number",
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

/** Encodes raw RGBA pixels (an ImageData) into AVIF bytes with libavif/libaom. */
export async function encode(
  data: ImageData,
  options: AvifEncodeOptions = {},
): Promise<ArrayBuffer> {
  const resolved = resolveEncodeOptions(options);
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
      resolved.quality,
      resolved.qualityAlpha,
      resolved.speed,
      FORMAT_CODE[resolved.pixelFormat],
      sizePtr,
    );
    if (outPtr === 0) throw new Error("libavif encode failed (the codec returned no output).");
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
