/**
 * @dusrel/image-batch
 *
 * The batch layer for the @dusrel/image family — what
 * @dusrel/image's processBatch deliberately is not: a worker-pool
 * scheduler with pause/resume, per-item retries and timeouts, a
 * byte-budget memory safeguard, a long-lived add-anytime queue,
 * and a real Web Worker pool speaking a tiny RPC protocol.
 * Task-agnostic: anything async can be batched, image pipelines
 * included.
 */
export { BatchController } from "./controller.js";
export { BatchQueue } from "./queue.js";
export { runBatch } from "./run-batch.js";
export { createWorkerPool, type WorkerPool, type WorkerPoolOptions } from "./worker-pool.js";
export type {
  BatchItemResult,
  BatchOptions,
  BatchProgress,
  BatchTask,
  TaskContext,
} from "./types.js";
