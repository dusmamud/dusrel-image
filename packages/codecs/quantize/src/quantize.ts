import { loadModule, setCodecAssets } from "./module.js";
import type {
  CodecAssets,
  QuantizeOptions,
  QuantizeResult,
  ResolvedQuantizeOptions,
} from "./types.js";

/** Applies defaults and validates options (pure; unit tested). */
export function resolveOptions(options: QuantizeOptions = {}): ResolvedQuantizeOptions {
  const maxColors = options.maxColors ?? 256;
  if (!Number.isInteger(maxColors) || maxColors < 2 || maxColors > 256) {
    throw new RangeError(
      `maxColors must be an integer between 2 and 256, got ${String(maxColors)}.`,
    );
  }
  const dithering = options.dithering ?? 1;
  if (typeof dithering !== "number" || !(dithering >= 0 && dithering <= 1)) {
    throw new RangeError(`dithering must be a number between 0 and 1, got ${String(dithering)}.`);
  }
  return { maxColors, dithering };
}

/** Loads and instantiates the WASM ahead of first use. */
export async function init(assetOverrides?: CodecAssets): Promise<void> {
  if (assetOverrides) setCodecAssets(assetOverrides);
  await loadModule();
}

/**
 * Quantizes an ImageData down to a palette of at most maxColors
 * colours plus one index per pixel — the ingredients of an 8-bit
 * PNG and the biggest single PNG size win (the guide's ~75%
 * median saving expectation). quantizeToImageData is the
 * convenience form most callers want.
 */
export async function quantize(
  data: ImageData,
  options: QuantizeOptions = {},
): Promise<QuantizeResult> {
  const resolved = resolveOptions(options);
  const expected = data.width * data.height * 4;
  if (data.data.length !== expected) {
    throw new RangeError(
      `ImageData length ${data.data.length} does not match ${data.width}x${data.height} RGBA (${expected}).`,
    );
  }
  const glue = await loadModule();
  if (!glue.dusrel_quantize) throw new Error("Quantize glue is missing dusrel_quantize.");
  const out = glue.dusrel_quantize(
    new Uint8Array(data.data),
    data.width,
    data.height,
    resolved.maxColors,
    resolved.dithering,
  );
  if (out.length < 8) throw new Error("Quantize module returned a malformed result.");
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const colorCount = view.getUint32(0, true);
  const error = view.getFloat32(4, true);
  const palette = new Uint8ClampedArray(out.subarray(8, 8 + colorCount * 4));
  const indices = new Uint8Array(out.subarray(8 + colorCount * 4));
  if (colorCount < 1 || colorCount > 256 || indices.length !== data.width * data.height) {
    throw new Error(
      `Quantize size mismatch: ${colorCount} colours, ${indices.length} indices for ${data.width}x${data.height}.`,
    );
  }
  return { palette, indices, colorCount, width: data.width, height: data.height, error };
}

/** Expands a QuantizeResult back into a full RGBA ImageData (pure). */
export function resultToImageData(result: QuantizeResult): ImageData {
  const out = new Uint8ClampedArray(result.width * result.height * 4);
  for (let p = 0; p < result.indices.length; p++) {
    const src = result.indices[p]! * 4;
    const dst = p * 4;
    out[dst] = result.palette[src]!;
    out[dst + 1] = result.palette[src + 1]!;
    out[dst + 2] = result.palette[src + 2]!;
    out[dst + 3] = result.palette[src + 3]!;
  }
  return new ImageData(out, result.width, result.height);
}

/** Quantize and immediately expand back to an ImageData. */
export async function quantizeToImageData(
  data: ImageData,
  options: QuantizeOptions = {},
): Promise<ImageData> {
  return resultToImageData(await quantize(data, options));
}
