import { describe, expect, it } from "vitest";
import { runPool } from "../src/batch.js";

const tick = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("runPool", () => {
  it("never exceeds the concurrency cap and preserves order", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = [50, 10, 40, 20, 30, 5];
    const results = await runPool(items, 2, async (ms, index) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await tick(ms);
      inFlight -= 1;
      return index * 10;
    });
    expect(maxInFlight).toBe(2);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : -1))).toEqual([
      0, 10, 20, 30, 40, 50,
    ]);
  });

  it("collects failures as values by default", async () => {
    const results = await runPool([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });

  it("fails fast when continueOnError is false", async () => {
    const started: number[] = [];
    await expect(
      runPool(
        [1, 2, 3, 4, 5],
        1,
        async (n) => {
          started.push(n);
          if (n === 2) throw new Error("boom");
          return n;
        },
        { continueOnError: false },
      ),
    ).rejects.toThrow("boom");
    expect(started).toEqual([1, 2]);
  });

  it("marks unstarted items rejected when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("stop"));
    const results = await runPool([1, 2], 2, async (n) => n, { signal: controller.signal });
    expect(results.every((r) => r.status === "rejected")).toBe(true);
  });

  it("rejects a non-positive concurrency", async () => {
    await expect(runPool([1], 0, async (n) => n)).rejects.toMatchObject({
      code: "invalid-options",
    });
  });

  it("reports each settle exactly once", async () => {
    const seen: number[] = [];
    await runPool([1, 2, 3], 2, async (n) => n, { onSettle: (index) => seen.push(index) });
    expect(seen.sort()).toEqual([0, 1, 2]);
  });
});
