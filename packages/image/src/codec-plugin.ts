/**
 * Codec + pixel-transform plugin factories — the Phase 2
 * registration surface (docs/API_DESIGN.md section 6: "a plugin may
 * add a step (transform) or a codec (format)").
 *
 * The codec packages stay standalone on purpose (no dependency on
 * this package, separately installable). Registration is therefore
 * by injection: the developer imports the codec's `encode` and
 * hands it to `codecPlugin`, and the pipeline gains a real WASM
 * encoder — including formats Canvas cannot produce at all, like
 * AVIF:
 *
 *   import { pipeline, codecPlugin } from '@dusrel/image';
 *   import { encode } from '@dusrel/image-avif';
 *
 *   await pipeline(input)
 *     .resize({ width: 800 })
 *     .use(codecPlugin({ mimeType: 'image/avif', encode, options: { quality: 60 } }))
 *     .run();
 *
 * `imageDataPlugin` is the transform sibling: it adapts any
 * ImageData -> ImageData function (e.g. @dusrel/image-resize's
 * `resize`, @dusrel/image-quantize's `quantizeToImageData`) into a
 * pipeline step. Its output re-enters the pipeline as a lossless
 * PNG Blob, exactly like every other plugin step.
 */
import type { ImagePlugin, PluginContext } from "./types.js";

/** Decodes a Blob into raw pixels (EXIF orientation honoured). */
export async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2d context unavailable for plugin decode.");
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    }
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable for plugin decode.");
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/**
 * The structural pixel shape the feature packages use — DOM
 * ImageData satisfies it, and so do plain objects from
 * @dusrel/image-transform and friends. Plugin transforms may
 * return either; the runtime normalises before touching canvas
 * APIs, which demand a genuine ImageData instance.
 */
export interface PixelDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Wraps structural pixel data in a genuine ImageData when needed. */
export function toImageData(data: PixelDataLike): ImageData {
  if (typeof ImageData !== "undefined" && data instanceof ImageData) return data;
  return new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
}

/** Encodes raw pixels as a lossless PNG Blob (the plugin interchange format). */
export async function imageDataToPngBlob(data: PixelDataLike): Promise<Blob> {
  const imageData = toImageData(data);
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable for plugin encode.");
    ctx.putImageData(imageData, 0, 0);
    return canvas.convertToBlob({ type: "image/png" });
  }
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable for plugin encode.");
  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encode for plugin step failed."))),
      "image/png",
    );
  });
}

export interface CodecPluginDefinition<Options = unknown> {
  /** Step name for the report. Default: derived from mimeType ('image/avif' -> 'codec:avif'). */
  name?: string;
  /** Output MIME type, e.g. 'image/avif'. */
  mimeType: string;
  /** The codec package's encode function (ImageData -> encoded bytes). */
  encode: (
    data: ImageData,
    options?: Options,
  ) => Promise<ArrayBuffer | Uint8Array> | ArrayBuffer | Uint8Array;
  /** Options forwarded verbatim to the codec's encode. */
  options?: Options;
}

export interface ImageDataPluginDefinition {
  /** Step name for the report, e.g. 'resize:quality'. */
  name: string;
  /**
   * The transform: pixels in, pixels out (may change dimensions).
   * May return a genuine ImageData or any structural PixelData —
   * the feature packages' plain-object results work as-is.
   */
  transform: (data: ImageData) => Promise<PixelDataLike> | PixelDataLike;
}

const MIME_PATTERN = /^image\/[a-z0-9][a-z0-9.+-]*$/i;

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason ?? new Error("Aborted.");
}

/** Validates a codec plugin definition (pure; unit tested). */
export function resolveCodecPluginName<Options = unknown>(
  def: CodecPluginDefinition<Options>,
): string {
  if (!def || typeof def.encode !== "function") {
    throw new TypeError("codecPlugin requires an encode function (the codec package's encode).");
  }
  if (typeof def.mimeType !== "string" || !MIME_PATTERN.test(def.mimeType)) {
    throw new TypeError(
      `codecPlugin requires a valid image MIME type, got ${String(def?.mimeType)}.`,
    );
  }
  return def.name ?? `codec:${def.mimeType.slice("image/".length).toLowerCase()}`;
}

/** Builds a pipeline plugin that encodes with a WASM codec package. */
export function codecPlugin<Options = unknown>(def: CodecPluginDefinition<Options>): ImagePlugin {
  const name = resolveCodecPluginName(def);
  return {
    name,
    async apply(blob: Blob, context: PluginContext): Promise<Blob> {
      throwIfAborted(context.signal);
      const pixels = await blobToImageData(blob);
      const bytes = await def.encode(pixels, def.options);
      throwIfAborted(context.signal);
      return new Blob([bytes as BlobPart], { type: def.mimeType });
    },
  };
}

/** Builds a pipeline plugin from an ImageData -> ImageData transform. */
export function imageDataPlugin(def: ImageDataPluginDefinition): ImagePlugin {
  if (!def || typeof def.transform !== "function") {
    throw new TypeError("imageDataPlugin requires a transform function.");
  }
  if (typeof def.name !== "string" || def.name.length === 0) {
    throw new TypeError("imageDataPlugin requires a non-empty name.");
  }
  return {
    name: def.name,
    async apply(blob: Blob, context: PluginContext): Promise<Blob> {
      throwIfAborted(context.signal);
      const pixels = await blobToImageData(blob);
      const transformed = await def.transform(pixels);
      throwIfAborted(context.signal);
      return imageDataToPngBlob(transformed);
    },
  };
}
