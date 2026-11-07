/**
 * Shared public types for @dusrel/image-core.
 * The one-shape contract lives in docs/API_DESIGN.md section 1.
 */

/** Anything the pipeline can decode. `File` is a `Blob`. */
export type ImageInput =
  | Blob
  | ArrayBuffer
  | Uint8Array
  | ImageData
  | ImageBitmap
  | HTMLCanvasElement
  | OffscreenCanvas
  | HTMLImageElement;

/** Formats the Canvas engine can encode natively. */
export type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

export const OUTPUT_FORMATS: readonly OutputFormat[] = ["image/jpeg", "image/png", "image/webp"];

/** Crop rectangle in source pixels. Must lie fully inside the source. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeFit = "inside" | "cover" | "fill";

export interface ResizeOptions {
  width?: number;
  height?: number;
  /**
   * `inside` (default): fit within the box, aspect preserved.
   * `cover`: fill the box exactly, aspect preserved, overflow centre-cropped.
   * `fill`: stretch to the box exactly, aspect not preserved.
   * `cover` and `fill` require both width and height.
   */
  fit?: ResizeFit;
}

export type ProgressStep = "decode" | "transform" | "encode" | "done";

export interface ProcessOptions {
  /**
   * Output format. Default: the input Blob's type when supported;
   * `image/png` for canvas/ImageData sources (they may carry alpha);
   * otherwise `image/jpeg`.
   */
  format?: OutputFormat;
  /** 0..1, default 0.85. Ignored for PNG (lossless). */
  quality?: number;
  crop?: Rect;
  resize?: ResizeOptions;
  /** Degrees clockwise. Any value; multiples of 90 are exact. */
  rotate?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  /**
   * Fill colour used where rotation exposes corners and when flattening
   * transparency for JPEG. Default `#ffffff` for JPEG output, transparent
   * otherwise. Set to `null` to force transparency (non-JPEG only).
   */
  background?: string | null;
  /**
   * Target-size mode: re-encode with descending quality (bounded binary
   * search) until the output is at most this many bytes. Lossy formats
   * only. When the budget cannot be met even at minimum quality, the
   * smallest best-effort result is returned and `targetSizeMet` is false.
   */
  maxSizeBytes?: number;
  signal?: AbortSignal;
  onProgress?: (step: ProgressStep) => void;
}

export interface ProcessResult {
  blob: Blob;
  format: OutputFormat;
  width: number;
  height: number;
  /** Output size in bytes (same as `blob.size`). */
  sizeBytes: number;
  /** Input size in bytes when the input carried one (Blob/ArrayBuffer). */
  originalSizeBytes?: number;
  /** The quality actually used (after any target-size search). */
  qualityUsed: number;
  /** Present when `maxSizeBytes` was requested: whether the budget was met. */
  targetSizeMet?: boolean;
  /** Ordered names of the operations applied, e.g. `['crop', 'rotate', 'resize']`. */
  steps: string[];
}
