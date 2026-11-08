/**
 * @dusrel/image-svelte
 *
 * Thin Svelte bindings over @dusrel/image and @dusrel/image-crop:
 * store factories for processing (single + batch) and a
 * DusrelCrop component (shipped as .svelte source at
 * '@dusrel/image-svelte/DusrelCrop.svelte'). UI state only —
 * all processing stays in the core pipeline.
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
export { createProcessImage, createProcessBatch } from "./stores.js";
export type { ProcessBatchStores, ProcessImageStores } from "./stores.js";
