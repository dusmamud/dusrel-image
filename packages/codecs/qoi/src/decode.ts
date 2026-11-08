import { loadModule, setCodecAssets } from "./module.js";
import type { CodecAssets } from "./types.js";

/** Loads and instantiates the decoder WASM ahead of first use. */
export async function initDecode(assetOverrides?: CodecAssets): Promise<void> {
  if (assetOverrides) setCodecAssets(assetOverrides);
  await loadModule("dec");
}

/**
 * Decodes QOI bytes into an ImageData (always RGBA8; RGB sources
 * are expanded with alpha 255 by the Rust glue). The glue
 * returns an 8-byte little-endian width/height prefix followed
 * by RGBA bytes.
 */
export async function decode(data: ArrayBuffer | Uint8Array): Promise<ImageData> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const glue = await loadModule("dec");
  if (!glue.dusrel_qoi_decode) throw new Error("QOI decoder glue is missing dusrel_qoi_decode.");
  const out = glue.dusrel_qoi_decode(bytes);
  if (out.length < 8) throw new Error("QOI decoder returned a malformed result.");
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const width = view.getUint32(0, true);
  const height = view.getUint32(4, true);
  const rgba = out.subarray(8);
  if (rgba.length !== width * height * 4) {
    throw new Error(
      `QOI decoder size mismatch: got ${rgba.length} RGBA bytes for ${width}x${height}.`,
    );
  }
  return new ImageData(new Uint8ClampedArray(rgba), width, height);
}
