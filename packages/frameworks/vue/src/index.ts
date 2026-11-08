/**
 * @dusrel/image-vue
 *
 * Thin Vue bindings over @dusrel/image and @dusrel/image-crop:
 * composables for processing (single + batch) and a DusrelCrop
 * component with v-model support. UI state only — all
 * processing stays in the core pipeline.
 */
export { createProcessor, createBatchProcessor } from "./processor.js";
export type {
  BatchProcessor,
  BatchProcessorState,
  BatchFn,
  ProcessFn,
  Processor,
  ProcessorState,
  ProcessorStatus,
} from "./processor.js";
export { useProcessImage, useProcessBatch } from "./use-process-image.js";
export type { UseProcessBatch, UseProcessImage } from "./use-process-image.js";
export { DusrelCrop } from "./DusrelCrop.js";
export type { DusrelCropProps } from "./DusrelCrop.js";
