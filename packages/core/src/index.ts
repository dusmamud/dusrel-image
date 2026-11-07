/**
 * @dusrel/image-core
 *
 * Tiny zero-dependency core: decode helpers, the Canvas/OffscreenCanvas
 * engine, a worker runtime, shared types and typed errors. No WASM, no
 * UI, no network. See docs/ARCHITECTURE.md and docs/API_DESIGN.md.
 */
export { DusrelImageError, isDusrelImageError, type DusrelErrorCode } from "./errors.js";
export {
  OUTPUT_FORMATS,
  type ImageInput,
  type OutputFormat,
  type ProcessOptions,
  type ProcessResult,
  type ProgressStep,
  type Rect,
  type ResizeFit,
  type ResizeOptions,
} from "./types.js";
export {
  normalizeRotation,
  planTransform,
  resizedDimensions,
  rotatedDimensions,
  validateCrop,
  type Dimensions,
  type TransformPlan,
} from "./geometry.js";
export { decodeImage, type DecodedImage } from "./decode.js";
export {
  createCanvas,
  encodeCanvas,
  getContext2d,
  type AnyCanvas,
  type Canvas2DContext,
} from "./encode.js";
export {
  findQualityForTargetSize,
  type QualitySearchOptions,
  type QualitySearchResult,
} from "./target-size.js";
export { processImage } from "./process.js";
export {
  installWorkerHandler,
  type WorkerProcessOptions,
  type WorkerProcessRequest,
  type WorkerProcessResponse,
} from "./worker.js";
