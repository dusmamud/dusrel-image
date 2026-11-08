import {
  computed,
  getCurrentInstance,
  onUnmounted,
  shallowRef,
  type ComputedRef,
  type ShallowRef,
} from "vue";
import {
  createBatchProcessor,
  createProcessor,
  type BatchProcessorState,
  type ProcessFn,
  type BatchFn,
  type ProcessorState,
} from "./processor.js";
import type {
  BatchItemResult,
  BatchOptions,
  ImageInput,
  ImageOptions,
  ImageResult,
} from "@dusrel/image";

export interface UseProcessImage {
  state: ShallowRef<ProcessorState>;
  status: ComputedRef<ProcessorState["status"]>;
  progress: ComputedRef<number>;
  result: ComputedRef<ImageResult | undefined>;
  error: ComputedRef<unknown>;
  processing: ComputedRef<boolean>;
  process: (input: ImageInput, options?: ImageOptions) => Promise<ImageResult | undefined>;
  abort: () => void;
  reset: () => void;
}

/**
 * Vue composable over @dusrel/image's processImage with state,
 * progress and abort handled. Aborts automatically when the
 * calling component unmounts. The process function is
 * injectable (defaults to processImage) for tests and custom
 * engines.
 */
export function useProcessImage(processFn?: ProcessFn): UseProcessImage {
  const processor = createProcessor(processFn);
  const state = shallowRef<ProcessorState>(processor.getState());
  const unsubscribe = processor.subscribe(() => {
    state.value = processor.getState();
  });
  if (getCurrentInstance()) {
    onUnmounted(() => {
      unsubscribe();
      processor.abort();
    });
  }
  return {
    state,
    status: computed(() => state.value.status),
    progress: computed(() => state.value.progress),
    result: computed(() => state.value.result),
    error: computed(() => state.value.error),
    processing: computed(() => state.value.status === "processing"),
    process: processor.process,
    abort: processor.abort,
    reset: processor.reset,
  };
}

export interface UseProcessBatch {
  state: ShallowRef<BatchProcessorState>;
  status: ComputedRef<BatchProcessorState["status"]>;
  /** 0..1 fraction settled (0 when total is 0). */
  progress: ComputedRef<number>;
  results: ComputedRef<BatchItemResult[] | undefined>;
  error: ComputedRef<unknown>;
  processing: ComputedRef<boolean>;
  process: (
    inputs: readonly ImageInput[],
    options?: BatchOptions,
  ) => Promise<BatchItemResult[] | undefined>;
  abort: () => void;
  reset: () => void;
}

/** The batch counterpart of {@link useProcessImage}, over processBatch. */
export function useProcessBatch(batchFn?: BatchFn): UseProcessBatch {
  const processor = createBatchProcessor(batchFn);
  const state = shallowRef<BatchProcessorState>(processor.getState());
  const unsubscribe = processor.subscribe(() => {
    state.value = processor.getState();
  });
  if (getCurrentInstance()) {
    onUnmounted(() => {
      unsubscribe();
      processor.abort();
    });
  }
  return {
    state,
    status: computed(() => state.value.status),
    progress: computed(() =>
      state.value.total > 0 ? state.value.completed / state.value.total : 0,
    ),
    results: computed(() => state.value.results),
    error: computed(() => state.value.error),
    processing: computed(() => state.value.status === "processing"),
    process: processor.process,
    abort: processor.abort,
    reset: processor.reset,
  };
}
