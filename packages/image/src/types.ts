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

export interface ImageOptions extends ProcessOptions {
  fallback?: FallbackPolicy;
  /** Abort the operation after this many milliseconds. */
  timeoutMs?: number;
  /** Step plugins, run in order between pipeline segments. Fluent API only. */
  plugins?: ImagePlugin[];
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
  format: OutputFormat;
  /** Operations actually applied, in order. */
  stepsApplied: string[];
  durationMs: number;
  /** Fallbacks that fired, e.g. `downgrade-format:image/webp->image/jpeg`. */
  fallbacks: string[];
}

export interface ImageResult extends ProcessResult {
  report: ProcessReport;
}

/** Context handed to a plugin step. */
export interface PluginContext {
  /** Result of the previous segment, when one has run. */
  previous?: ProcessResult;
  signal?: AbortSignal;
}

/**
 * A plugin step transforms a Blob into a Blob (docs/API_DESIGN.md
 * section 6). Plugins run only when registered on a pipeline.
 */
export interface ImagePlugin {
  name: string;
  apply: (blob: Blob, context: PluginContext) => Promise<Blob>;
}
