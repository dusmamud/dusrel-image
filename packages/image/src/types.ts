/**
 * Public types for @dusrel/image — the main package.
 *
 * Easy mode is implemented on top of the same engine as pro mode
 * (docs/API_DESIGN.md section 2): exactly one code path, defaults layered
 * over it.
 */
import type { ImageInput, OutputFormat, ProcessOptions, ProcessResult } from "@dusrel/image-core";

export type { ImageInput, OutputFormat, ProcessResult };

/**
 * What happens when processing fails:
 * - `throw` (default): the typed error propagates.
 * - `return-original`: hand the untouched input back (Blob/ArrayBuffer
 *   inputs only; anything else rethrows, because there is no honest
 *   "original" Blob to return).
 * - `downgrade-format`: on `unsupported-format`, retry the chain
 *   webp -> jpeg -> png until one encodes.
 */
export type FallbackPolicy = "throw" | "return-original" | "downgrade-format";

/**
 * A codec registration: a WASM codec package's encode function plus
 * the MIME type it produces (docs/API_DESIGN.md section 6, stabilised
 * in ADR-0007). Register via `ImageOptions.codecs` and select with
 * `format`, or turn one into a pipeline step with `codecPlugin`.
 */
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

export interface ImageOptions extends Omit<ProcessOptions, "format"> {
  /**
   * Output format: a canvas MIME type ('image/jpeg' | 'image/png' |
   * 'image/webp'), or the MIME type of a codec registered in
   * `codecs`. An unregistered non-canvas format fails with the
   * typed `unsupported-format` error - never a silent fallback.
   */
  format?: string;
  fallback?: FallbackPolicy;
  /** Abort the operation after this many milliseconds. */
  timeoutMs?: number;
  /**
   * Step plugins. On a pipeline they run at their registered
   * position; in easy mode (`processImage`) they run in order
   * after the core pass (and before a registered codec encode).
   */
  plugins?: ImagePlugin[];
  /** Codec registrations that make non-canvas formats selectable via `format`. */
  codecs?: CodecPluginDefinition[];
}

/** The processing report every entry point returns (docs/ARCHITECTURE.md section 1). */
export interface ProcessReport {
  engine: "canvas";
  /** Input bytes, when the input carried a size. */
  originalBytes?: number;
  finalBytes: number;
  /** (original - final) / original, when the input size is known. */
  savingsRatio?: number;
  width: number;
  height: number;
  /** Output MIME type: a canvas format, or a registered codec's. */
  format: string;
  /** Operations actually applied, in order. */
  stepsApplied: string[];
  durationMs: number;
  /** Fallbacks that fired, e.g. `downgrade-format:image/webp->image/jpeg`. */
  fallbacks: string[];
}

export interface ImageResult extends Omit<ProcessResult, "format"> {
  /** Output MIME type: a canvas format, or a registered codec's. */
  format: string;
  report: ProcessReport;
}

/**
 * The previous stage's result as plugins see it: the core result
 * shape with `format` widened to any MIME type (a codec stage may
 * have produced it).
 */
export interface PluginPreviousResult extends Omit<ProcessResult, "format"> {
  format: string;
}

/** Context handed to a plugin step. */
export interface PluginContext {
  /** Result of the previous segment, when one has run. */
  previous?: PluginPreviousResult;
  signal?: AbortSignal;
}

/**
 * A plugin step transforms a Blob into a Blob (docs/API_DESIGN.md
 * section 6). Plugins run only when registered on a pipeline.
 */
export interface ImagePlugin {
  name: string;
  /**
   * The MIME type this step's output carries, when the step changes
   * it (codec steps set this; the report's format follows it).
   */
  format?: string;
  apply: (blob: Blob, context: PluginContext) => Promise<Blob>;
}
