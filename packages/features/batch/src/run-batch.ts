import {
  abortError,
  timeoutError,
  toError,
  type BatchItemResult,
  type BatchOptions,
  type BatchProgress,
  type BatchTask,
  type TaskContext,
} from "./types.js";

interface ResolvedOptions<TIn> {
  concurrency: number;
  retries: number;
  retryDelayMs: number;
  continueOnError: boolean;
  signal: AbortSignal | undefined;
  controller: BatchOptions<TIn>["controller"];
  onProgress: BatchOptions<TIn>["onProgress"];
  sizeOf: BatchOptions<TIn>["sizeOf"];
  maxInFlightBytes: number | undefined;
  itemTimeoutMs: number | undefined;
}

function resolveOptions<TIn>(options: BatchOptions<TIn>): ResolvedOptions<TIn> {
  const concurrency = options.concurrency ?? 2;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError(`concurrency must be a positive integer, got ${String(concurrency)}.`);
  }
  const retries = options.retries ?? 0;
  if (!Number.isInteger(retries) || retries < 0) {
    throw new RangeError(`retries must be a non-negative integer, got ${String(retries)}.`);
  }
  return {
    concurrency,
    retries,
    retryDelayMs: options.retryDelayMs ?? 0,
    continueOnError: options.continueOnError ?? true,
    signal: options.signal,
    controller: options.controller,
    onProgress: options.onProgress,
    sizeOf: options.sizeOf,
    maxInFlightBytes: options.maxInFlightBytes,
    itemTimeoutMs: options.itemTimeoutMs,
  };
}

/**
 * Runs `task` over `items` with a bounded worker-pool scheduler:
 * concurrency lanes, optional per-item retries and timeouts, a
 * byte-budget memory safeguard, pause/resume via a controller,
 * and AbortSignal cancellation. Results come back in input
 * order; failures are values unless continueOnError is false.
 */
export async function runBatch<TIn, TOut>(
  items: readonly TIn[],
  task: BatchTask<TIn, TOut>,
  options: BatchOptions<TIn> = {},
): Promise<Array<BatchItemResult<TOut>>> {
  const o = resolveOptions(options);
  const total = items.length;
  const results: Array<BatchItemResult<TOut> | undefined> = new Array(total);
  let nextIndex = 0;
  let inFlight = 0;
  let inFlightBytes = 0;
  let completed = 0;
  let succeeded = 0;
  let failed = 0;
  let firstError: Error | undefined;
  let stopped = false; // fail-fast triggered

  const isAborted = () => (o.signal?.aborted ?? false) || (o.controller?.signal.aborted ?? false);
  const isPaused = () => o.controller?.paused ?? false;

  // Wake-up plumbing: the scheduler sleeps until something changes.
  let wake: (() => void) | undefined;
  const waitForChange = () =>
    new Promise<void>((resolve) => {
      wake = resolve;
    });
  const notify = () => {
    const w = wake;
    wake = undefined;
    w?.();
  };
  const unsubscribes: Array<() => void> = [];
  if (o.controller) unsubscribes.push(o.controller.subscribe(notify));
  const onExternalAbort = () => notify();
  o.signal?.addEventListener("abort", onExternalAbort, { once: true });
  o.controller?.signal.addEventListener("abort", onExternalAbort, { once: true });

  const report = () => {
    o.onProgress?.({ total, completed, succeeded, failed, inFlight });
  };

  const runAttempt = async (item: TIn, index: number, attempt: number): Promise<TOut> => {
    // Compose the item signal: batch abort + per-attempt timeout.
    const itemController = new AbortController();
    const linkAbort = () => itemController.abort();
    if (isAborted()) itemController.abort();
    o.signal?.addEventListener("abort", linkAbort, { once: true });
    o.controller?.signal.addEventListener("abort", linkAbort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timeoutReject: ((e: Error) => void) | undefined;
    const timeoutPromise = o.itemTimeoutMs
      ? new Promise<never>((_, reject) => {
          timeoutReject = reject;
          timer = setTimeout(() => {
            itemController.abort();
            reject(timeoutError(o.itemTimeoutMs!));
          }, o.itemTimeoutMs);
        })
      : undefined;
    const ctx: TaskContext = { index, signal: itemController.signal, attempt };
    try {
      const value = timeoutPromise
        ? await Promise.race([task(item, ctx), timeoutPromise])
        : await task(item, ctx);
      return value;
    } finally {
      if (timer) clearTimeout(timer);
      o.signal?.removeEventListener("abort", linkAbort);
      o.controller?.signal.removeEventListener("abort", linkAbort);
      void timeoutReject;
    }
  };

  const runItem = async (index: number): Promise<void> => {
    const item = items[index]!;
    const size = o.sizeOf ? o.sizeOf(item) : 0;
    inFlight++;
    inFlightBytes += size;
    try {
      let attempt = 0;
      for (;;) {
        try {
          const value = await runAttempt(item, index, attempt);
          if (!results[index]) {
            results[index] = { status: "fulfilled", index, value };
            succeeded++;
            completed++;
          }
          return;
        } catch (rawError) {
          const error = toError(rawError);
          if (isAborted()) {
            if (!results[index]) {
              results[index] = { status: "rejected", index, error: abortError() };
              failed++;
              completed++;
            }
            return;
          }
          if (attempt < o.retries) {
            attempt++;
            if (o.retryDelayMs) await new Promise((r) => setTimeout(r, o.retryDelayMs));
            if (isAborted()) {
              if (!results[index]) {
                results[index] = { status: "rejected", index, error: abortError() };
                failed++;
                completed++;
              }
              return;
            }
            continue;
          }
          if (!results[index]) {
            results[index] = { status: "rejected", index, error };
            failed++;
            completed++;
          }
          if (!o.continueOnError && !firstError) {
            firstError = error;
            stopped = true;
          }
          return;
        }
      }
    } finally {
      inFlight--;
      inFlightBytes -= size;
      report();
      notify();
    }
  };

  try {
    for (;;) {
      // Start as many items as the gates allow.
      while (
        nextIndex < total &&
        inFlight < o.concurrency &&
        !isAborted() &&
        !isPaused() &&
        !stopped
      ) {
        const size = o.sizeOf ? o.sizeOf(items[nextIndex]!) : 0;
        if (
          o.maxInFlightBytes !== undefined &&
          inFlight > 0 &&
          inFlightBytes + size > o.maxInFlightBytes
        ) {
          break; // memory safeguard: wait for a lane to drain
        }
        const index = nextIndex++;
        void runItem(index);
      }
      if (completed >= total) break;
      if ((isAborted() || stopped) && inFlight === 0) {
        // Everything still pending is settled as rejected here.
        for (let i = 0; i < total; i++) {
          if (!results[i]) {
            results[i] = {
              status: "rejected",
              index: i,
              error: isAborted()
                ? abortError()
                : (firstError ?? new Error("Batch stopped after a failure.")),
            };
            failed++;
            completed++;
          }
        }
        break;
      }
      if (inFlight === 0 && (isPaused() || isAborted() || stopped)) {
        // Paused with nothing running: sleep until state changes.
        await waitForChange();
        continue;
      }
      if (inFlight === 0 && nextIndex >= total && completed < total) {
        // Should not happen, but never spin forever.
        await waitForChange();
        continue;
      }
      if (inFlight > 0) {
        await waitForChange();
      }
    }
  } finally {
    for (const u of unsubscribes) u();
    o.signal?.removeEventListener("abort", onExternalAbort);
    o.controller?.signal.removeEventListener("abort", onExternalAbort);
  }

  if (firstError && !o.continueOnError) throw firstError;
  return results as Array<BatchItemResult<TOut>>;
}
