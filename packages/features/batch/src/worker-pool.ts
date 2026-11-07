import { abortError, toError, type BatchTask } from "./types.js";

export interface WorkerPoolOptions {
  /** Number of Web Workers to spawn. Default 2. */
  size?: number;
  /**
   * Worker script type. Default 'module' (the image-core adapter
   * is ESM). Use 'classic' for Blob-URL workers: Chromium cannot
   * start module workers from blob: URLs on opaque-origin pages
   * (e.g. about:blank) — it hangs silently instead of erroring.
   */
  type?: "module" | "classic";
}

export interface WorkerPool<TIn, TOut> {
  /** A BatchTask backed by the pool — pass it to runBatch or BatchQueue. */
  task: BatchTask<TIn, TOut>;
  readonly size: number;
  terminate(): void;
}

interface WorkerState<TOut> {
  worker: Worker;
  /** A message is outstanding (replies settle `current`). */
  occupied: boolean;
  current:
    | {
        id: number;
        resolve: (value: TOut) => void;
        reject: (error: Error) => void;
      }
    | undefined;
}

/**
 * A pool of real Web Workers speaking a tiny RPC protocol:
 *
 *   request:  { id, payload }
 *   response: { id, ok: true, value } | { id, ok: false, error }
 *
 * One task per worker at a time; extra tasks queue inside the
 * pool (size the pool to match your batch concurrency). Payloads
 * and values must be structured-cloneable — Blobs and ArrayBuffers
 * are, which is what image work needs. A worker script for
 * @dusrel/image-core's handler is a three-line adapter (see the
 * README).
 */
export function createWorkerPool<TIn, TOut>(
  url: string | URL,
  options: WorkerPoolOptions = {},
): WorkerPool<TIn, TOut> {
  if (typeof Worker === "undefined") {
    throw new Error("createWorkerPool needs the Web Worker API in this environment.");
  }
  const size = options.size ?? 2;
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`size must be a positive integer, got ${String(size)}.`);
  }
  let terminated = false;
  let nextId = 1;
  interface Waiter {
    item: TIn;
    resolve: (value: TOut) => void;
    reject: (error: Error) => void;
    signal: AbortSignal;
    onAbort: () => void;
  }
  const waiters: Waiter[] = [];

  const pump = (): void => {
    if (terminated) return;
    for (const state of states) {
      if (state.occupied) continue;
      const waiter = waiters.shift();
      if (!waiter) return;
      waiter.signal.removeEventListener("abort", waiter.onAbort);
      const id = nextId++;
      state.occupied = true;
      state.current = { id, resolve: waiter.resolve, reject: waiter.reject };
      state.worker.postMessage({ id, payload: waiter.item });
    }
  };

  const states: Array<WorkerState<TOut>> = Array.from({ length: size }, () => {
    const worker = new Worker(url, { type: options.type ?? "module" });
    const state: WorkerState<TOut> = { worker, occupied: false, current: undefined };
    worker.addEventListener("message", (event: MessageEvent) => {
      const data = event.data as { id?: number; ok?: boolean; value?: TOut; error?: string };
      const current = state.current;
      state.occupied = false;
      state.current = undefined;
      if (current && data && data.id === current.id) {
        if (data.ok) current.resolve(data.value as TOut);
        else current.reject(new Error(data.error ?? "Worker task failed"));
      }
      pump();
    });
    worker.addEventListener("error", (event: ErrorEvent) => {
      const current = state.current;
      state.occupied = false;
      state.current = undefined;
      current?.reject(toError(event.message || "Worker error"));
      pump();
    });
    return state;
  });

  const task: BatchTask<TIn, TOut> = (item, ctx) =>
    new Promise<TOut>((resolve, reject) => {
      if (terminated) {
        reject(new Error("This worker pool has been terminated."));
        return;
      }
      if (ctx.signal.aborted) {
        reject(abortError());
        return;
      }
      let waiterRef: Waiter | undefined;
      const onAbort = () => {
        if (!waiterRef) return;
        const at = waiters.indexOf(waiterRef);
        if (at >= 0) {
          waiters.splice(at, 1);
          reject(abortError());
        }
        // In-flight aborts cannot recall a posted message; the
        // batch layer records the item as aborted and the late
        // reply is simply unmatched when it returns.
      };
      const waiter: Waiter = { item, resolve, reject, signal: ctx.signal, onAbort };
      waiterRef = waiter;
      ctx.signal.addEventListener("abort", onAbort, { once: true });
      waiters.push(waiter);
      pump();
    });

  return {
    task,
    size,
    terminate() {
      terminated = true;
      for (const waiter of waiters.splice(0)) waiter.reject(new Error("Worker pool terminated."));
      for (const state of states) {
        state.current?.reject(new Error("Worker pool terminated."));
        state.current = undefined;
        state.worker.terminate();
      }
    },
  };
}
