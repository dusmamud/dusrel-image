import { loadModule, setCodecAssets, type EmscriptenCodecModule } from "./module.js";
import type { CodecAssets } from "./types.js";

type DecodeFn = (data: number, size: number, outWidth: number, outHeight: number) => number;

let decodeFn: DecodeFn | undefined;

async function getDecodeFn(): Promise<{ mod: EmscriptenCodecModule; fn: DecodeFn }> {
  const mod = await loadModule("dec");
  decodeFn ??= mod.cwrap("dusrel_avif_decode", "number", [
    "number",
    "number",
    "number",
    "number",
  ]) as DecodeFn;
  return { mod, fn: decodeFn };
}

/** Loads and instantiates the decoder WASM ahead of first use. */
export async function initDecode(assetOverrides?: CodecAssets): Promise<void> {
  if (assetOverrides) setCodecAssets(assetOverrides);
  await loadModule("dec");
}

/**
 * Decodes JPEG bytes into raw RGBA pixels (an ImageData, alpha = 255).
 */
export async function decode(data: ArrayBuffer | Uint8Array): Promise<ImageData> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length === 0) throw new RangeError("Cannot decode an empty byte buffer.");
  const { mod, fn } = await getDecodeFn();
  const inPtr = mod._malloc(bytes.length);
  const widthPtr = mod._malloc(4);
  const heightPtr = mod._malloc(4);
  try {
    mod.HEAPU8.set(bytes, inPtr);
    const outPtr = fn(inPtr, bytes.length, widthPtr, heightPtr);
    if (outPtr === 0) {
      throw new Error("libavif decode failed (the input is not a decodable AVIF).");
    }
    try {
      const width = mod.HEAPU32[widthPtr >> 2] as number;
      const height = mod.HEAPU32[heightPtr >> 2] as number;
      const pixels = mod.HEAPU8.slice(outPtr, outPtr + width * height * 4);
      return new ImageData(new Uint8ClampedArray(pixels), width, height);
    } finally {
      mod._free(outPtr);
    }
  } finally {
    mod._free(inPtr);
    mod._free(widthPtr);
    mod._free(heightPtr);
  }
}
