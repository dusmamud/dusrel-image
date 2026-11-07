/**
 * @dusrel/image
 *
 * Main package: one-call easy mode and the fluent pro pipeline composing
 * @dusrel/image-core (and, from Phase 2, the WASM codec packages).
 * Fallback cascade, plugin steps and a full processing report included.
 */
export { processImage } from "./process.js";
export {
  pipeline,
  PipelineBuilder,
  buildSegments,
  type PipelineOp,
  type PipelineSegment,
} from "./pipeline.js";
export { downgradeChain } from "./fallback.js";
export type {
  FallbackPolicy,
  ImageOptions,
  ImagePlugin,
  ImageResult,
  PluginContext,
  ProcessReport,
} from "./types.js";
export {
  DusrelImageError,
  isDusrelImageError,
  type DusrelErrorCode,
  type ImageInput,
  type OutputFormat,
  type ProcessResult,
  type Rect,
  type ResizeOptions,
} from "@dusrel/image-core";
