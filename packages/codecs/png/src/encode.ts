import { loadModule, setCodecAssets } from "./module.js";
import type { CodecAssets, PngEncodeOptions, ResolvedPngEncodeOptions } from "./types.js";

const COMPRESSION_CODE = { fast: 0, default: 1, best: 2 } as const;
const FILTER_CODE = { none: 0, sub: 1, up: 2, avg: 3, paeth: 4, adaptive: 5 } as const;

/** Applies defaults and validates encode options (pure; unit tested). */
export function resolveEncodeOptions(options: PngEncodeOptions = {}): ResolvedPngEncodeOptions {
  const compression = options.compression ?? "default";
  if (compression !== "fast" && compression !== "default" && compression !== "best") {
    throw new RangeError(
      `compression must be 'fast', 'default' or 'best', got ${String(compression)}.`,
    );
  }
  const filter = options.filter ?? "adaptive";
  if (!["none", "sub", "up", "avg", "paeth", "adaptive"].includes(filter)) {
    throw new RangeError(`filter must be a PngFilter value, got ${String(filter)}.`);
  }
  return { compression, filter };
}

/** Loads and instantiates the encoder WASM ahead of first use. */
export async function initEncode(assetOverrides?: CodecAssets): Promise<void> {
  if (assetOverrides) setCodecAssets(assetOverrides);
  await loadModule("enc");
}

/** Encodes raw RGBA pixels (an ImageData) into lossless PNG bytes. */
export async function encode(
  data: ImageData,
  options: PngEncodeOptions = {},
): Promise<ArrayBuffer> {
  const resolved = resolveEncodeOptions(options);
  const expected = data.width * data.height * 4;
  if (data.data.length !== expected) {
    throw new RangeError(
      `ImageData length ${data.data.length} does not match ${data.width}x${data.height} RGBA (${expected}).`,
    );
  }
  const glue = await loadModule("enc");
  if (!glue.dusrel_png_encode) throw new Error("PNG encoder glue is missing dusrel_png_encode.");
  const out = glue.dusrel_png_encode(
    new Uint8Array(data.data),
    data.width,
    data.height,
    COMPRESSION_CODE[resolved.compression],
    FILTER_CODE[resolved.filter],
  );
  return out.buffer as ArrayBuffer;
}
