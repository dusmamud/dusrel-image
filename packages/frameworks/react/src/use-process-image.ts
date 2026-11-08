import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  createBatchProcessor,
  createProcessor,
  type BatchProcessor,
  type BatchProcessorState,
  type Processor,
  type ProcessorState,
} from "./processor.js";
import type { BatchOptions, ImageInput, ImageOptions } from "@dusrel/image";

export interface UseProcessImage extends ProcessorState {
  process: Processor["process"];
  abort: Processor["abort"];
  reset: Processor["reset"];
  processing: boolean;
}

/**
 * React hook over @dusrel/image's processImage with state,
 * progress and abort handled. Aborts automatically on unmount.
 *
 * ```tsx
 * const { process, status, result, progress } = useProcessImage();
 * <input type="file" onChange={(e) => e.target.files?.[0] && process(e.target.files[0], { format: "image/webp", quality: 0.8 })} />
 * ```
 */
export function useProcessImage(): UseProcessImage {
  const ref = useRef<Processor | undefined>(undefined);
  ref.current ??= createProcessor();
  const processor = ref.current;
  const state = useSyncExternalStore(processor.subscribe, processor.getState, processor.getState);
  useEffect(() => () => processor.abort(), [processor]);
  return {
    ...state,
    process: processor.process,
    abort: processor.abort,
    reset: processor.reset,
    processing: state.status === "processing",
  };
}

export interface UseProcessBatch extends BatchProcessorState {
  process: BatchProcessor["process"];
  abort: BatchProcessor["abort"];
  reset: BatchProcessor["reset"];
  processing: boolean;
  /** 0..1 fraction settled (0 when total is 0). */
  progress: number;
}

/** The batch counterpart of {@link useProcessImage}, over processBatch. */
export function useProcessBatch(): UseProcessBatch {
  const ref = useRef<BatchProcessor | undefined>(undefined);
  ref.current ??= createBatchProcessor();
  const processor = ref.current;
  const state = useSyncExternalStore(processor.subscribe, processor.getState, processor.getState);
  useEffect(() => () => processor.abort(), [processor]);
  return {
    ...state,
    process: processor.process,
    abort: processor.abort,
    reset: processor.reset,
    processing: state.status === "processing",
    progress: state.total > 0 ? state.completed / state.total : 0,
  };
}

export type { BatchOptions, ImageInput, ImageOptions };
