import { describe, expect, it } from "vitest";
import { createProcessor, type ProcessFn } from "../src/processor.js";
import { DusrelCrop, useProcessBatch, useProcessImage } from "../src/index.js";

// The processor core is shared in shape with the React package
// and unit-tested with injected fakes; the composables bridge
// it to Vue reactivity, which also runs headless in Node. The
// component itself is proven mounted in the Playwright suite.

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

describe("createProcessor (vue package core)", () => {
  it("walks idle → processing → success", async () => {
    const p = createProcessor(async () => fakeResult());
    await p.process(new Blob(["in"]));
    expect(p.getState().status).toBe("success");
  });

  it("abort returns to idle", async () => {
    const fn: ProcessFn = (_input, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    const p = createProcessor(fn);
    const run = p.process(new Blob(["in"]));
    p.abort();
    expect(await run).toBeUndefined();
    expect(p.getState().status).toBe("idle");
  });
});

describe("useProcessImage composable", () => {
  it("exposes reactive state driven by the processor", async () => {
    const { process, status, result, progress, processing } = useProcessImage(async () =>
      fakeResult(),
    );
    expect(status.value).toBe("idle");
    await process(new Blob(["in"]));
    expect(status.value).toBe("success");
    expect(processing.value).toBe(false);
    expect(progress.value).toBe(1);
    expect(result.value?.blob.type).toBe("image/webp");
  });

  it("captures errors reactively", async () => {
    const { process, status, error } = useProcessImage(async () => {
      throw new Error("boom");
    });
    await process(new Blob(["in"]));
    expect(status.value).toBe("error");
    expect((error.value as Error).message).toBe("boom");
  });
});

describe("public surface", () => {
  it("exports the documented bindings", () => {
    expect(typeof createProcessor).toBe("function");
    expect(typeof useProcessImage).toBe("function");
    expect(typeof useProcessBatch).toBe("function");
    expect(DusrelCrop).toBeTypeOf("object");
    expect((DusrelCrop as { name?: string }).name).toBe("DusrelCrop");
  });
});
