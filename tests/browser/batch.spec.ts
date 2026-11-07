import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-batch: the scheduler
// semantics are unit-proven in Node; here the REAL Web Worker
// pool runs — a worker created from a Blob URL speaking the
// package's RPC protocol, processing items off the main thread.
const batchBundle = readFileSync(
  new URL("../../packages/features/batch/dist/index.js", import.meta.url),
  "utf8",
);

type BatchMod = typeof import("../../packages/features/batch/src/index.js");

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await page.evaluate((content) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/javascript" }));
    (window as unknown as { __bUrl: string }).__bUrl = url;
  }, batchBundle);
  await page.evaluate(async () => {
    const w = window as unknown as { __bUrl: string; __b: BatchMod };
    w.__b = (await import(w.__bUrl)) as BatchMod;
  });
});

test("worker pool processes a batch off the main thread", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __b: b } = window as unknown as { __b: BatchMod };
    const workerSource = `
      self.onmessage = (e) => {
        const { id, payload } = e.data;
        let acc = 0;
        for (let i = 0; i < payload; i++) acc += i;
        self.postMessage({ id, ok: true, value: acc });
      };
    `;
    const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    const pool = b.createWorkerPool<number, number>(url, { size: 2 });
    try {
      const results = await b.runBatch([100, 200, 300, 400], pool.task, { concurrency: 2 });
      return results.map((x) => (x.status === "fulfilled" ? x.value : -1));
    } finally {
      pool.terminate();
      URL.revokeObjectURL(url);
    }
  });
  // sum 0..n-1 = n(n-1)/2
  expect(r).toEqual([4950, 19900, 44850, 79800]);
});

test("BatchQueue in the browser: pause holds items, resume drains", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __b: b } = window as unknown as { __b: BatchMod };
    const queue = new b.BatchQueue<number, number>(async (n) => n * 3);
    queue.pause();
    queue.add(1, 2);
    await new Promise((res) => setTimeout(res, 30));
    const held = queue.completedCount;
    queue.resume();
    const results = await queue.drain();
    return { held, values: results.map((x) => (x.status === "fulfilled" ? x.value : -1)) };
  });
  expect(r.held).toBe(0);
  expect(r.values).toEqual([3, 6]);
});
