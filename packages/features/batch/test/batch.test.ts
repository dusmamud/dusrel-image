import { describe, expect, it } from "vitest";
import {
  BatchController,
  BatchQueue,
  createWorkerPool,
  runBatch,
  type BatchItemResult,
} from "../src/index.js";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const values = <T>(results: Array<BatchItemResult<T>>) =>
  results.map((r) => (r.status === "fulfilled" ? r.value : `ERR:${r.error.name}`));

describe("runBatch scheduler", () => {
  it("preserves input order regardless of completion order", async () => {
    const results = await runBatch([30, 5, 15], async (ms) => {
      await delay(ms);
      return ms * 2;
    });
    expect(values(results)).toEqual([60, 10, 30]);
  });

  it("never exceeds the concurrency cap", async () => {
    let active = 0;
    let maxActive = 0;
    const results = await runBatch(
      [1, 2, 3, 4, 5, 6],
      async (n) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await delay(15);
        active--;
        return n;
      },
      { concurrency: 2 },
    );
    expect(maxActive).toBe(2);
    expect(values(results)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("reports progress that ends at the totals", async () => {
    const seen: number[] = [];
    await runBatch([1, 2, 3], async (n) => n, {
      onProgress: (p) => seen.push(p.completed),
    });
    expect(seen[seen.length - 1]).toBe(3);
  });

  it("turns failures into values by default", async () => {
    const results = await runBatch([1, 2], async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(results[0]?.status).toBe("fulfilled");
    expect(results[1]?.status).toBe("rejected");
    expect((results[1] as { error: Error }).error.message).toBe("boom");
  });

  it("fail-fast rejects the whole run with the first error", async () => {
    await expect(
      runBatch(
        [1, 2, 3],
        async (n) => {
          if (n === 2) throw new Error("fatal");
          await delay(5);
          return n;
        },
        { concurrency: 1, continueOnError: false },
      ),
    ).rejects.toThrow("fatal");
  });

  it("retries with the attempt counter visible to the task", async () => {
    const attempts: number[] = [];
    const results = await runBatch(
      ["x"],
      async (_item, ctx) => {
        attempts.push(ctx.attempt);
        if (ctx.attempt === 0) throw new Error("flaky");
        return "ok";
      },
      { retries: 2 },
    );
    expect(attempts).toEqual([0, 1]);
    expect(values(results)).toEqual(["ok"]);
  });

  it("times out a stuck attempt with a TimeoutError", async () => {
    const results = await runBatch(["x"], () => delay(5000).then(() => "never"), {
      itemTimeoutMs: 25,
    });
    expect(results[0]?.status).toBe("rejected");
    expect((results[0] as { error: Error }).error.name).toBe("TimeoutError");
  }, 5000);

  it("pause blocks new starts until resume", async () => {
    const controller = new BatchController();
    controller.pause();
    let started = 0;
    const run = runBatch(
      [1, 2],
      async (n) => {
        started++;
        return n;
      },
      { controller },
    );
    await delay(40);
    expect(started).toBe(0);
    controller.resume();
    const results = await run;
    expect(values(results)).toEqual([1, 2]);
  });

  it("abort settles pending items as AbortError", async () => {
    const external = new AbortController();
    const run = runBatch(
      [1, 2, 3, 4, 5],
      async (n) => {
        await delay(25);
        return n;
      },
      { concurrency: 1, signal: external.signal },
    );
    setTimeout(() => external.abort(), 40);
    const results = await run;
    expect(results).toHaveLength(5);
    expect(results[0]?.status).toBe("fulfilled");
    const rest = results.slice(2);
    expect(rest.every((r) => r.status === "rejected" && r.error.name === "AbortError")).toBe(true);
  });

  it("memory safeguard caps in-flight bytes but never deadlocks on an oversize item", async () => {
    let bytes = 0;
    let maxBytes = 0;
    const results = await runBatch(
      [10, 10, 10, 10],
      async (size) => {
        bytes += size;
        maxBytes = Math.max(maxBytes, bytes);
        await delay(15);
        bytes -= size;
        return size;
      },
      { concurrency: 4, sizeOf: (n) => n, maxInFlightBytes: 15 },
    );
    expect(maxBytes).toBeLessThanOrEqual(15);
    expect(values(results)).toEqual([10, 10, 10, 10]);

    const oversize = await runBatch([100], async (n) => n, {
      sizeOf: (n) => n,
      maxInFlightBytes: 50,
    });
    expect(values(oversize)).toEqual([100]);
  });

  it("validates options", async () => {
    await expect(runBatch([1], async (n) => n, { concurrency: 0 })).rejects.toThrow(RangeError);
  });
});

describe("BatchQueue", () => {
  it("drains waves in add order and accepts later adds", async () => {
    const queue = new BatchQueue<number, number>(async (n) => {
      await delay(5);
      return n * 2;
    });
    queue.add(1, 2, 3);
    const first = await queue.drain();
    expect(values(first)).toEqual([2, 4, 6]);
    expect(first.map((r) => r.index)).toEqual([0, 1, 2]);
    queue.add(4);
    const second = await queue.drain();
    expect(values(second)).toEqual([2, 4, 6, 8]);
    expect(second.map((r) => r.index)).toEqual([0, 1, 2, 3]);
  });

  it("pause/resume through the queue controller", async () => {
    const queue = new BatchQueue<number, number>(async (n) => n);
    queue.pause();
    queue.add(7);
    await delay(30);
    expect(queue.completedCount).toBe(0);
    queue.resume();
    const results = await queue.drain();
    expect(values(results)).toEqual([7]);
  });
});

describe("createWorkerPool (environment gate)", () => {
  it("throws a clear error where the Worker API is absent", () => {
    if (typeof Worker === "undefined") {
      expect(() => createWorkerPool("worker.js")).toThrow(/Worker/);
    }
  });
});
