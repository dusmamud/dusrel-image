export interface TaskContext {
  /** Index of the item in the input array. */
  index: number;
  /** Aborts when the batch is cancelled (or the item times out). */
  signal: AbortSignal;
  /** 0 for the first try, increments on retries. */
  attempt: number;
}

export type BatchTask<TIn, TOut> = (item: TIn, ctx: TaskContext) => Promise<TOut>;

export type BatchItemResult<TOut> =
  | { status: "fulfilled"; index: number; value: TOut }
  | { status: "rejected"; index: number; error: Error };

export interface BatchProgress {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  inFlight: number;
}

export interface BatchOptions<TIn> {
  /** Parallel task lanes. Default 2 (matches @dusrel/image's processBatch). */
  concurrency?: number;
  /** External cancellation. */
  signal?: AbortSignal;
  /** Pause/resume + cancellation control (takes precedence over `signal` composition — both are honoured). */
  controller?: BatchControllerLike;
  /** Per-item retries after a failure. Default 0. */
  retries?: number;
  /** Delay between retries in ms. Default 0. */
  retryDelayMs?: number;
  /** Per-attempt timeout in ms. Default: none. */
  itemTimeoutMs?: number;
  /** Item weight estimator for the memory safeguard. */
  sizeOf?: (item: TIn) => number;
  /**
   * Memory safeguard: never let the summed sizeOf() of in-flight
   * items exceed this budget. A single item larger than the
   * budget still runs (alone) — the safeguard throttles, it never
   * deadlocks.
   */
  maxInFlightBytes?: number;
  /** Default true: failures become rejected results. False: the first failure rejects the whole run. */
  continueOnError?: boolean;
  onProgress?: (progress: BatchProgress) => void;
}

export interface BatchControllerLike {
  readonly paused: boolean;
  readonly signal: AbortSignal;
  /** Internal: scheduler wake-up subscription. */
  subscribe(listener: () => void): () => void;
}

export function toError(value: unknown): Error {
  return value instanceof Error
    ? value
    : new Error(typeof value === "string" ? value : "Task failed");
}

export function abortError(): Error {
  const error = new Error("The batch was aborted.");
  error.name = "AbortError";
  return error;
}

export function timeoutError(ms: number): Error {
  const error = new Error(`Item timed out after ${ms} ms.`);
  error.name = "TimeoutError";
  return error;
}
