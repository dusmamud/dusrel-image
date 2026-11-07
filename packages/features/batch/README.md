# @dusrel/image-batch

The batch layer for the @dusrel/image family: a worker-pool
scheduler with pause/resume, per-item retries and timeouts, a
byte-budget memory safeguard, an add-anytime queue, and a real
Web Worker pool. Task-agnostic — anything async can be batched.

```bash
npm install @dusrel/image-batch
```

```ts
import { runBatch, BatchQueue, createWorkerPool } from '@dusrel/image-batch';

const results = await runBatch(files, (file) => processImage(file), {
  concurrency: 3,
  retries: 1,
  sizeOf: (file) => file.size,
  maxInFlightBytes: 256 * 1024 * 1024,   // memory safeguard
  onProgress: ({ completed, total }) => updateBar(completed / total),
});
```

## API

| Export | What it does |
| --- | --- |
| `runBatch(items, task, options?)` | One-shot pool run; results in input order, failures as values |
| `BatchQueue` | Long-lived queue: `add()` any time, `pause()` / `resume()` / `cancel()`, `drain()` |
| `BatchController` | Pause/resume/abort control shared by runs and queues |
| `createWorkerPool(url, { size, type })` | Real Web Workers behind a `BatchTask` (`type: 'classic'` for Blob-URL workers — Chromium hangs on module workers from blob: URLs on opaque-origin pages) |

## Options that matter

- `concurrency` (default 2) — parallel lanes.
- `retries`, `retryDelayMs`, `itemTimeoutMs` — per-item
  resilience; the task sees `ctx.attempt` and a per-attempt
  `ctx.signal` that fires on timeout or batch abort.
- `sizeOf` + `maxInFlightBytes` — the **memory safeguard**: the
  scheduler never lets the summed size of in-flight items exceed
  the budget (decoding ten 50 MP photos at once is how tabs die).
  A single item larger than the budget still runs, alone — the
  safeguard throttles, it never deadlocks.
- `continueOnError: false` — fail-fast: the run rejects with the
  first error (the default keeps going and returns
  `{ status: 'rejected', error }` values, like
  `@dusrel/image`'s `processBatch`).

## The worker pool protocol

Workers speak a tiny RPC: the pool posts `{ id, payload }` and
expects `{ id, ok: true, value }` or `{ id, ok: false, error }`
back. Payloads must be structured-cloneable (Blobs and
ArrayBuffers are). Adapting `@dusrel/image-core`'s worker handler
is a few lines:

```ts
// worker.ts
import { createWorkerHandler } from '@dusrel/image-core';
const handler = createWorkerHandler();
self.onmessage = async (e) => {
  const { id, payload } = e.data;
  try {
    self.postMessage({ id, ok: true, value: await handler(payload) });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) });
  }
};
```

## Relationship to @dusrel/image's processBatch

`processBatch` (Phase 1) is the simple fixed-pool runner baked
into the flagship package. This package is the full control
surface — queues, pause/resume, retries, timeouts, memory
budgets, real workers — for apps that process hundreds of files.

## Status

Implemented (Phase 3). The scheduler is proven by Node unit
tests (concurrency cap, ordering, pause/abort semantics,
timeout/retry, byte-budget throttling without deadlock). The
Playwright suite runs the real Worker pool from a Blob URL in
Chromium, Firefox and WebKit.
