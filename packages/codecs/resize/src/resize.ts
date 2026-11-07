import { loadModule, setCodecAssets } from "./module.js";
import type { CodecAssets, ResizeOptions, ResolvedResizeOptions } from "./types.js";

const FILTER_CODE = {
  nearest: 0,
  triangle: 1,
  "catmull-rom": 2,
  mitchell: 3,
  bspline: 4,
  gaussian: 5,
  lanczos3: 6,
} as const;

/** Applies defaults and validates options (pure; unit tested). */
export function resolveOptions(options: ResizeOptions): ResolvedResizeOptions {
  const { width, height } = options;
  if (!Number.isInteger(width) || width <= 0) {
    throw new RangeError(`width must be a positive integer, got ${String(width)}.`);
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new RangeError(`height must be a positive integer, got ${String(height)}.`);
  }
  const filter = options.filter ?? "lanczos3";
  if (!(filter in FILTER_CODE)) {
    throw new RangeError(`filter must be a ResizeFilter value, got ${String(filter)}.`);
  }
  const alpha = options.alpha ?? "premultiplied";
  if (alpha !== "premultiplied" && alpha !== "straight") {
    throw new RangeError(`alpha must be 'premultiplied' or 'straight', got ${String(alpha)}.`);
  }
  return { width, height, filter, alpha };
}

/** Loads and instantiates the WASM ahead of first use. */
export async function init(assetOverrides?: CodecAssets): Promise<void> {
  if (assetOverrides) setCodecAssets(assetOverrides);
  await loadModule();
}

/**
 * Resamples an ImageData to a new size with the `resize` crate's
 * filters (the Squoosh/jSquash engine). Returns a new ImageData.
 */
export async function resize(data: ImageData, options: ResizeOptions): Promise<ImageData> {
  const resolved = resolveOptions(options);
  const expected = data.width * data.height * 4;
  if (data.data.length !== expected) {
    throw new RangeError(
      `ImageData length ${data.data.length} does not match ${data.width}x${data.height} RGBA (${expected}).`,
    );
  }
  const glue = await loadModule();
  if (!glue.dusrel_resize) throw new Error("Resize glue is missing dusrel_resize.");
  const out = glue.dusrel_resize(
    new Uint8Array(data.data),
    data.width,
    data.height,
    resolved.width,
    resolved.height,
    FILTER_CODE[resolved.filter],
    resolved.alpha === "premultiplied",
  );
  if (out.length < 8) throw new Error("Resize module returned a malformed result.");
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const width = view.getUint32(0, true);
  const height = view.getUint32(4, true);
  const rgba = out.subarray(8);
  if (
    width !== resolved.width ||
    height !== resolved.height ||
    rgba.length !== width * height * 4
  ) {
    throw new Error(`Resize size mismatch: got ${width}x${height} (${rgba.length} bytes).`);
  }
  return new ImageData(new Uint8ClampedArray(rgba), width, height);
}
