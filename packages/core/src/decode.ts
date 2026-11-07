/**
 * Input decoding: everything becomes a drawable source with known size.
 *
 * Primary path is `createImageBitmap` with EXIF orientation applied
 * (`imageOrientation: 'from-image'`), which works in workers. When a Blob
 * cannot go through it (older Safari), a main-thread <img> fallback is
 * used where a document exists.
 */
import { DusrelImageError, throwIfAborted, wrapError } from "./errors.js";
import type { ImageInput } from "./types.js";

export interface DecodedImage {
  source: ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  /** True when core created the source and must release it (`ImageBitmap.close`). */
  owned: boolean;
  originalSizeBytes?: number;
}

function sizeOf(input: ImageInput): number | undefined {
  if (input instanceof Blob) return input.size;
  if (input instanceof ArrayBuffer) return input.byteLength;
  if (input instanceof Uint8Array) return input.byteLength;
  return undefined;
}

async function bitmapFromBlob(blob: Blob, signal?: AbortSignal): Promise<ImageBitmap> {
  throwIfAborted(signal);
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch (cause) {
    // Fallback: decode through an <img> element on the main thread.
    if (typeof document !== "undefined") {
      const url = URL.createObjectURL(blob);
      try {
        const img = new Image();
        img.decoding = "sync";
        const loaded = new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image element failed to load the input."));
        });
        img.src = url;
        await loaded;
        throwIfAborted(signal);
        const bitmap = await createImageBitmap(img);
        return bitmap;
      } catch (fallbackCause) {
        throw wrapError(
          "decode-failed",
          "The input could not be decoded as an image.",
          fallbackCause,
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    throw wrapError("decode-failed", "The input could not be decoded as an image.", cause);
  }
}

export async function decodeImage(
  input: ImageInput,
  controls: { signal?: AbortSignal } = {},
): Promise<DecodedImage> {
  const { signal } = controls;
  throwIfAborted(signal);
  const originalSizeBytes = sizeOf(input);

  try {
    if (input instanceof ImageBitmap) {
      return withSize(
        { source: input, width: input.width, height: input.height, owned: false },
        originalSizeBytes,
      );
    }
    if (input instanceof Blob) {
      const bitmap = await bitmapFromBlob(input, signal);
      return withSize(
        { source: bitmap, width: bitmap.width, height: bitmap.height, owned: true },
        originalSizeBytes,
      );
    }
    if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
      const blob = new Blob([input as BlobPart]);
      const bitmap = await bitmapFromBlob(blob, signal);
      return withSize(
        { source: bitmap, width: bitmap.width, height: bitmap.height, owned: true },
        originalSizeBytes,
      );
    }
    if (typeof ImageData !== "undefined" && input instanceof ImageData) {
      const bitmap = await createImageBitmap(input);
      return withSize(
        { source: bitmap, width: bitmap.width, height: bitmap.height, owned: true },
        originalSizeBytes,
      );
    }
    if (typeof HTMLImageElement !== "undefined" && input instanceof HTMLImageElement) {
      if (!input.complete || input.naturalWidth === 0) {
        throw new DusrelImageError("invalid-input", "The <img> input has not finished loading.");
      }
      return withSize(
        { source: input, width: input.naturalWidth, height: input.naturalHeight, owned: false },
        originalSizeBytes,
      );
    }
    if (
      (typeof HTMLCanvasElement !== "undefined" && input instanceof HTMLCanvasElement) ||
      (typeof OffscreenCanvas !== "undefined" && input instanceof OffscreenCanvas)
    ) {
      return withSize(
        { source: input, width: input.width, height: input.height, owned: false },
        originalSizeBytes,
      );
    }
  } catch (cause) {
    throw wrapError("decode-failed", "The input could not be decoded as an image.", cause);
  }

  throw new DusrelImageError(
    "invalid-input",
    "Unsupported input type. Expected Blob, ArrayBuffer, Uint8Array, ImageData, ImageBitmap, canvas or image element.",
  );
}

function withSize(
  base: Omit<DecodedImage, "originalSizeBytes">,
  originalSizeBytes: number | undefined,
): DecodedImage {
  if (base.width < 1 || base.height < 1) {
    if (base.owned && base.source instanceof ImageBitmap) base.source.close();
    throw new DusrelImageError("decode-failed", "The decoded image has no pixels.");
  }
  const decoded: DecodedImage = { ...base };
  if (originalSizeBytes !== undefined) decoded.originalSizeBytes = originalSizeBytes;
  return decoded;
}
