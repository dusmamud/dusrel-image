import {
  processBatch,
  processImage,
  type BatchItemResult,
  type BatchOptions,
  type BatchProgressEvent,
  type ImageInput,
  type ImageOptions,
  type ImageResult,
  type ProgressStep,
} from "@dusrel/image";

export type ProcessorStatus = "idle" | "processing" | "success" | "error";

export interface ProcessorState {
  status: ProcessorStatus;
  /** Latest pipeline step while processing ("decode" → "done"). */
  step: ProgressStep | undefined;
  /** Coarse 0..1 progress derived from the step (0.25 per step). */
  progress: number;
  result: ImageResult | undefined;
  error: unknown;
}

export type ProcessFn = (input: ImageInput, options?: ImageOptions) => Promise<ImageResult>;

const STEP_PROGRESS: Record<ProgressStep, number> = {
  decode: 0.25,
  transform: 0.5,
  encode: 0.75,
  done: 1,
};

const INITIAL: ProcessorState = {
  status: "idle",
  step: undefined,
  progress: 0,
  result: undefined,
  error: undefined,
};

function isAbortError(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof Error && error.name === "AbortError");
}

function composeSignal(internal: AbortSignal, user?: AbortSignal): AbortSignal {
  if (!user) return internal;
  return AbortSignal.any([internal, user]);
}

/**
 * A framework-free processing store: the state machine the React
 * hook (and any other binding) sits on. Holds UI state only —
 * all processing stays in @dusrel/image. The process function
 * is injectable, which is how the core is unit-tested in Node.
 */
export interface Processor {
  getState(): ProcessorState;
  subscribe(listener: () => void): () => void;
  /** Runs the process; resolves to the result, or undefined when the run failed/aborted (see state). */
  process(input: ImageInput, options?: ImageOptions): Promise<ImageResult | undefined>;
  /** Aborts the in-flight run (state returns to idle). */
  abort(): void;
  /** Aborts and clears result/error back to the initial state. */
  reset(): void;
}

export function createProcessor(processFn: ProcessFn = processImage): Processor {
  let state: ProcessorState = INITIAL;
  const listeners = new Set<() => void>();
  let controller: AbortController | undefined;

  const setState = (next: ProcessorState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  const abort = () => {
    controller?.abort();
    controller = undefined;
    if (state.status === "processing") setState(INITIAL);
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async process(input, options) {
      controller?.abort();
      const mine = new AbortController();
      controller = mine;
      setState({
        status: "processing",
        step: undefined,
        progress: 0,
        result: undefined,
        error: undefined,
      });
      try {
        const result = await processFn(input, {
          ...options,
          signal: composeSignal(mine.signal, options?.signal),
          onProgress: (step) => {
            options?.onProgress?.(step);
            if (controller === mine) {
              setState({ ...state, step, progress: STEP_PROGRESS[step] ?? state.progress });
            }
          },
        });
        if (controller !== mine) return undefined; // superseded by a newer run/reset
        controller = undefined;
        setState({ status: "success", step: "done", progress: 1, result, error: undefined });
        return result;
      } catch (error) {
        if (controller !== mine) return undefined;
        controller = undefined;
        if (isAbortError(error, mine.signal)) {
          setState(INITIAL);
        } else {
          setState({ status: "error", step: undefined, progress: 0, result: undefined, error });
        }
        return undefined;
      }
    },
    abort,
    reset() {
      controller?.abort();
      controller = undefined;
      setState(INITIAL);
    },
  };
}

export interface BatchProcessorState {
  status: ProcessorStatus;
  /** Settled count so far (drives progress bars). */
  completed: number;
  total: number;
  results: BatchItemResult[] | undefined;
  error: unknown;
}

export type BatchFn = (
  inputs: readonly ImageInput[],
  options?: BatchOptions,
) => Promise<BatchItemResult[]>;

const BATCH_INITIAL: BatchProcessorState = {
  status: "idle",
  completed: 0,
  total: 0,
  results: undefined,
  error: undefined,
};

/** The batch counterpart of {@link createProcessor}. */
export interface BatchProcessor {
  getState(): BatchProcessorState;
  subscribe(listener: () => void): () => void;
  process(
    inputs: readonly ImageInput[],
    options?: BatchOptions,
  ): Promise<BatchItemResult[] | undefined>;
  abort(): void;
  reset(): void;
}

export function createBatchProcessor(batchFn: BatchFn = processBatch): BatchProcessor {
  let state: BatchProcessorState = BATCH_INITIAL;
  const listeners = new Set<() => void>();
  let controller: AbortController | undefined;

  const setState = (next: BatchProcessorState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async process(inputs, options) {
      controller?.abort();
      const mine = new AbortController();
      controller = mine;
      setState({
        status: "processing",
        completed: 0,
        total: inputs.length,
        results: undefined,
        error: undefined,
      });
      try {
        const results = await batchFn(inputs, {
          ...options,
          signal: composeSignal(mine.signal, options?.signal),
          onBatchProgress: (event: BatchProgressEvent) => {
            options?.onBatchProgress?.(event);
            if (controller === mine) {
              setState({ ...state, completed: event.completed, total: event.total });
            }
          },
        });
        if (controller !== mine) return undefined;
        controller = undefined;
        setState({
          status: "success",
          completed: inputs.length,
          total: inputs.length,
          results,
          error: undefined,
        });
        return results;
      } catch (error) {
        if (controller !== mine) return undefined;
        controller = undefined;
        if (isAbortError(error, mine.signal)) {
          setState(BATCH_INITIAL);
        } else {
          setState({ ...state, status: "error", error });
        }
        return undefined;
      }
    },
    abort() {
      controller?.abort();
      controller = undefined;
      if (state.status === "processing") setState(BATCH_INITIAL);
    },
    reset() {
      controller?.abort();
      controller = undefined;
      setState(BATCH_INITIAL);
    },
  };
}
