/**
 * Batch processing: many inputs, bounded concurrency, honest results.
 *
 * Defaults follow docs/API_DESIGN.md section 7: concurrency 2, one bad
 * item never sinks the batch (its error is returned as a value), and a
 * progress event fires as each item settles. Set `continueOnError: false`
 * for fail-fast behaviour instead.
 */
import { DusrelImageError, type ImageInput } from "@dusrel/image-core";
import { processImage } from "./process.js";
import type { ImageOptions, ImageResult } from "./types.js";

export type BatchItemResult =
  | { index: number; status: "fulfilled"; result: ImageResult }
  | { index: number; status: "rejected"; error: unknown };

export interface BatchProgressEvent {
  /** Items settled so far (1-based count). */
  completed: number;
  total: number;
  /** Index of the item that just settled. */
  index: number;
  status: "fulfilled" | "rejected";
}

export interface BatchOptions extends ImageOptions {
  /** Maximum items processed at once. Default 2. */
  concurrency?: number;
  /** Default true: failures are collected as values. False: fail fast. */
  continueOnError?: boolean;
  onBatchProgress?: (event: BatchProgressEvent) => void;
  /** Per-item option overrides, merged over the shared options. */
  perItem?: (input: ImageInput, index: number) => ImageOptions;
}

type Settled<R> = { status: "fulfilled"; value: R } | { status: "rejected"; reason: unknown };

/**
 * A tiny worker pool (pure scheduling; unit tested in Node). Runs
 * `worker` over `items` with at most `concurrency` in flight, preserves
 * input order in the results, and honours the abort signal.
 */
export async function runPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  options: {
    signal?: AbortSignal;
    continueOnError?: boolean;
    onSettle?: (index: number, settled: Settled<R>) => void;
  } = {},
): Promise<Settled<R>[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new DusrelImageError(
      "invalid-options",
      `concurrency must be a positive integer, got ${concurrency}.`,
    );
  }
  const continueOnError = options.continueOnError ?? true;
  const results: Settled<R>[] = new Array(items.length);
  let next = 0;
  let failure: unknown;
  let failed = false;

  const aborted = () => options.signal?.aborted ?? false;
  const abortReason = () =>
    options.signal?.reason ?? new DusrelImageError("aborted", "The batch was aborted.");

  const runner = async (): Promise<void> => {
    for (;;) {
      if (failed && !continueOnError) return;
      const index = next++;
      if (index >= items.length) return;
      if (aborted()) {
        const settled: Settled<R> = { status: "rejected", reason: abortReason() };
        results[index] = settled;
        options.onSettle?.(index, settled);
        continue;
      }
      try {
        const value = await worker(items[index] as T, index);
        const settled: Settled<R> = { status: "fulfilled", value };
        results[index] = settled;
        options.onSettle?.(index, settled);
      } catch (reason) {
        const settled: Settled<R> = { status: "rejected", reason };
        results[index] = settled;
        options.onSettle?.(index, settled);
        if (!continueOnError && !failed) {
          failed = true;
          failure = reason;
        }
      }
    }
  };

  const runners = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: runners }, () => runner()));
  if (failed && !continueOnError) throw failure;
  return results;
}

/**
 * Processes a batch of images through {@link processImage}.
 *
 * @example
 * const results = await processBatch(files, {
 *   format: 'image/webp',
 *   concurrency: 3,
 *   perItem: (file) => ({ maxSizeBytes: file.size > 1_000_000 ? 300_000 : undefined }),
 *   onBatchProgress: ({ completed, total }) => console.log(`${completed}/${total}`),
 * });
 */
export async function processBatch(
  inputs: readonly ImageInput[],
  options: BatchOptions = {},
): Promise<BatchItemResult[]> {
  const { concurrency = 2, continueOnError = true, onBatchProgress, perItem, ...shared } = options;
  let completed = 0;
  const settled = await runPool(
    inputs,
    concurrency,
    (input, index) => processImage(input, { ...shared, ...(perItem ? perItem(input, index) : {}) }),
    {
      ...(shared.signal ? { signal: shared.signal } : {}),
      continueOnError,
      onSettle: (index, item) => {
        completed += 1;
        onBatchProgress?.({ completed, total: inputs.length, index, status: item.status });
      },
    },
  );
  return settled.map(
    (item, index): BatchItemResult =>
      item.status === "fulfilled"
        ? { index, status: "fulfilled", result: item.value }
        : { index, status: "rejected", error: item.reason },
  );
}
