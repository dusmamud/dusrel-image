import { describe, expect, it, vi } from "vitest";
import {
  createBatchProcessor,
  createProcessor,
  type BatchFn,
  type ProcessFn,
} from "../src/processor.js";
import { DusrelCrop, useProcessBatch, useProcessImage } from "../src/index.js";

// The processor cores are framework-free stores — they are
// unit-tested here with injected fakes. The React bindings
// themselves are exercised in the Playwright suite
// (tests/browser/react.spec.ts) with a real mounted app.

function fakeResult(): Awaited<ReturnType<ProcessFn>> {
  return {
    blob: new Blob(["x"], { type: "image/webp" }),
    report: {
      engine: "canvas",
      finalBytes: 1,
      width: 1,
      height: 1,
      format: "image/webp",
      stepsApplied: ["ok"],
      durationMs: 1,
      fallbacks: [],
    },
  } as Awaited<ReturnType<ProcessFn>>;
}

describe("createProcessor", () => {
  it("walks idle → processing → success, forwarding steps as progress", async () => {
    const fn: ProcessFn = vi.fn(async (_input, options) => {
      options?.onProgress?.("decode");
      options?.onProgress?.("encode");
      return fakeResult();
    });
    const p = createProcessor(fn);
    const seen: string[] = [];
    p.subscribe(() => seen.push(`${p.getState().status}:${p.getState().progress}`));
    const out = await p.process(new Blob(["in"]));
    expect(out?.blob.type).toBe("image/webp");
    expect(p.getState().status).toBe("success");
    expect(p.getState().progress).toBe(1);
    expect(seen[0]).toBe("processing:0");
    expect(seen).toContain("processing:0.25");
    expect(seen).toContain("processing:0.75");
  });

  it("captures errors in state instead of throwing", async () => {
    const boom = new Error("nope");
    const p = createProcessor(async () => {
      throw boom;
    });
    const out = await p.process(new Blob(["in"]));
    expect(out).toBeUndefined();
    expect(p.getState().status).toBe("error");
    expect(p.getState().error).toBe(boom);
  });

  it("abort returns to idle and swallows the AbortError", async () => {
    const fn: ProcessFn = (_input, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    const p = createProcessor(fn);
    const run = p.process(new Blob(["in"]));
    expect(p.getState().status).toBe("processing");
    p.abort();
    expect(await run).toBeUndefined();
    expect(p.getState().status).toBe("idle");
    expect(p.getState().error).toBeUndefined();
  });

  it("a newer run supersedes an older one", async () => {
    let calls = 0;
    const fn: ProcessFn = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, calls === 1 ? 30 : 1));
      return fakeResult();
    };
    const p = createProcessor(fn);
    const first = p.process(new Blob(["a"]));
    const second = p.process(new Blob(["b"]));
    expect(await second).toBeDefined();
    expect(await first).toBeUndefined(); // stale run never touches state
    expect(p.getState().status).toBe("success");
  });

  it("reset clears back to the initial state", async () => {
    const p = createProcessor(async () => fakeResult());
    await p.process(new Blob(["in"]));
    p.reset();
    expect(p.getState()).toEqual({
      status: "idle",
      step: undefined,
      progress: 0,
      result: undefined,
      error: undefined,
    });
  });
});

describe("createBatchProcessor", () => {
  it("tracks settled counts from progress events", async () => {
    const fn: BatchFn = vi.fn(async (inputs, options) => {
      for (let i = 0; i < inputs.length; i++) {
        options?.onBatchProgress?.({
          completed: i + 1,
          total: inputs.length,
          index: i,
          status: "fulfilled",
        });
      }
      return inputs.map((_, index) => ({
        index,
        status: "fulfilled" as const,
        result: fakeResult(),
      }));
    });
    const p = createBatchProcessor(fn);
    const results = await p.process([new Blob(["a"]), new Blob(["b"]), new Blob(["c"])]);
    expect(results).toHaveLength(3);
    expect(p.getState().status).toBe("success");
    expect(p.getState().completed).toBe(3);
  });
});

describe("public surface", () => {
  it("exports the documented bindings", () => {
    expect(typeof createProcessor).toBe("function");
    expect(typeof createBatchProcessor).toBe("function");
    expect(typeof useProcessImage).toBe("function");
    expect(typeof useProcessBatch).toBe("function");
    expect(DusrelCrop).toBeTypeOf("object"); // forwardRef component
  });
});
