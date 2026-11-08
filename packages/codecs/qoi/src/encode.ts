import { loadModule, setCodecAssets } from "./module.js";
import type { CodecAssets } from "./types.js";

/** Loads and instantiates the encoder WASM ahead of first use. */
export async function initEncode(assetOverrides?: CodecAssets): Promise<void> {
  if (assetOverrides) setCodecAssets(assetOverrides);
  await loadModule("enc");
}

/**
 * Encodes raw RGBA pixels (an ImageData) into QOI bytes. QOI is
 * lossless and has no quality knobs: the header is written with
 * 4 channels and the sRGB colorspace tag (the tag is informative
 * only — it never changes pixels). Wrap the result in a Blob
 * with type "image/qoi" if you need one.
 */
export async function encode(data: ImageData): Promise<Uint8Array> {
  const expected = data.width * data.height * 4;
  if (data.data.length !== expected) {
    throw new RangeError(
      `ImageData length ${data.data.length} does not match ${data.width}x${data.height} RGBA (${expected}).`,
    );
  }
  const glue = await loadModule("enc");
  if (!glue.dusrel_qoi_encode) throw new Error("QOI encoder glue is missing dusrel_qoi_encode.");
  return glue.dusrel_qoi_encode(new Uint8Array(data.data), data.width, data.height);
}
