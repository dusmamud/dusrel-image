import { derived, writable, type Readable } from "svelte/store";
import {
  createBatchProcessor,
  createProcessor,
  type BatchFn,
  type ProcessFn,
  type ProcessorState,
  type BatchProcessorState,
  type ProcessorStatus,
} from "./processor.js";
import type {
  BatchItemResult,
  BatchOptions,
  ImageInput,
  ImageOptions,
  ImageResult,
} from "@dusrel/image";

export interface ProcessImageStores {
  /** The full processor state (single source of truth). */
  state: Readable<ProcessorState>;
  status: Readable<ProcessorStatus>;
  /** Coarse 0..1 progress (0.25 per pipeline step). */
  progress: Readable<number>;
  result: Readable<ImageResult | undefined>;
  error: Readable<unknown>;
  processing: Readable<boolean>;
  process: (input: ImageInput, options?: ImageOptions) => Promise<ImageResult | undefined>;
  abort: () => void;
  reset: () => void;
}

/**
 * Svelte stores over @dusrel/image's processImage. The state
 * store follows the Svelte store contract, so it works with
 * $auto-subscriptions in components and plain subscribe() in
 * vanilla TS. The process function is injectable (defaults to
 * processImage) for tests and custom engines.
 */
export function createProcessImage(processFn?: ProcessFn): ProcessImageStores {
  const processor = createProcessor(processFn);
  const state = writable<ProcessorState>(processor.getState(), (set) => {
    set(processor.getState());
    return processor.subscribe(() => set(processor.getState()));
  });
  return {
    state,
    status: derived(state, ($s) => $s.status),
    progress: derived(state, ($s) => $s.progress),
    result: derived(state, ($s) => $s.result),
    error: derived(state, ($s) => $s.error),
    processing: derived(state, ($s) => $s.status === "processing"),
    process: processor.process,
    abort: processor.abort,
    reset: processor.reset,
  };
}

export interface ProcessBatchStores {
  state: Readable<BatchProcessorState>;
  status: Readable<ProcessorStatus>;
  /** 0..1 fraction settled (0 when total is 0). */
  progress: Readable<number>;
  results: Readable<BatchItemResult[] | undefined>;
  error: Readable<unknown>;
  processing: Readable<boolean>;
  process: (
    inputs: readonly ImageInput[],
    options?: BatchOptions,
  ) => Promise<BatchItemResult[] | undefined>;
  abort: () => void;
  reset: () => void;
}

/** The batch counterpart of {@link createProcessImage}, over processBatch. */
export function createProcessBatch(batchFn?: BatchFn): ProcessBatchStores {
  const processor = createBatchProcessor(batchFn);
  const state = writable<BatchProcessorState>(processor.getState(), (set) => {
    set(processor.getState());
    return processor.subscribe(() => set(processor.getState()));
  });
  return {
    state,
    status: derived(state, ($s) => $s.status),
    progress: derived(state, ($s) => ($s.total > 0 ? $s.completed / $s.total : 0)),
    results: derived(state, ($s) => $s.results),
    error: derived(state, ($s) => $s.error),
    processing: derived(state, ($s) => $s.status === "processing"),
    process: processor.process,
    abort: processor.abort,
    reset: processor.reset,
  };
}
