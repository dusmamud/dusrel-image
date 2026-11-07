/**
 * Canvas encoding via OffscreenCanvas.convertToBlob (worker-safe) or
 * HTMLCanvasElement.toBlob. The returned Blob's real type is verified:
 * some browsers silently fall back to PNG when a format is unsupported,
 * and silently wrong output is worse than a typed error the pipeline can
 * fall back from.
 */
import { DusrelImageError, wrapError } from "./errors.js";
import type { OutputFormat } from "./types.js";

export type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
export type Canvas2DContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new DusrelImageError(
    "platform-unsupported",
    "Neither OffscreenCanvas nor a DOM canvas is available in this environment.",
  );
}

export function getContext2d(canvas: AnyCanvas): Canvas2DContext {
  const ctx = canvas.getContext("2d") as Canvas2DContext | null;
  if (!ctx) {
    throw new DusrelImageError("platform-unsupported", "A 2D canvas context could not be created.");
  }
  return ctx;
}

export async function encodeCanvas(
  canvas: AnyCanvas,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  let blob: Blob | null;
  try {
    if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
      blob = await canvas.convertToBlob({ type: format, quality });
    } else {
      blob = await new Promise<Blob | null>((resolve) => {
        (canvas as HTMLCanvasElement).toBlob(resolve, format, quality);
      });
    }
  } catch (cause) {
    throw wrapError("encode-failed", `Encoding to ${format} failed.`, cause);
  }
  if (!blob) {
    throw new DusrelImageError("encode-failed", `Encoding to ${format} produced no output.`);
  }
  if (blob.type !== format) {
    throw new DusrelImageError(
      "unsupported-format",
      `This browser cannot encode ${format} on canvas (it returned ${blob.type || "unknown"} instead).`,
    );
  }
  return blob;
}
