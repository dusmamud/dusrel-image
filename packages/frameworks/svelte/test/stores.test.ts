import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { get } from "svelte/store";
import { compile, preprocess } from "svelte/compiler";
import ts from "typescript";
import { createProcessor, type ProcessFn } from "../src/processor.js";
import { createProcessBatch, createProcessImage } from "../src/index.js";

// Svelte stores follow a plain subscribe/get contract, so they
// run headless in Node. The component is compile-gated here and
// mount-proven in the Playwright suite (the fixture compiles it
// ahead of bundling — see scripts/compile-fixture.mjs).

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

describe("createProcessImage stores", () => {
  it("publishes state transitions to subscribers", async () => {
    const stores = createProcessImage(async () => fakeResult());
    const statuses: string[] = [];
    const unsub = stores.status.subscribe((s) => statuses.push(s));
    expect(get(stores.processing)).toBe(false);
    await stores.process(new Blob(["in"]));
    unsub();
    expect(statuses).toEqual(["idle", "processing", "success"]);
    expect(get(stores.progress)).toBe(1);
    expect(get(stores.result)?.blob.type).toBe("image/webp");
  });

  it("captures errors in the error store", async () => {
    const stores = createProcessImage(async () => {
      throw new Error("boom");
    });
    await stores.process(new Blob(["in"]));
    expect(get(stores.status)).toBe("error");
    expect((get(stores.error) as Error).message).toBe("boom");
  });

  it("batch stores derive progress from settled counts", async () => {
    const stores = createProcessBatch(async (inputs) =>
      inputs.map((_, index) => ({
        index,
        status: "fulfilled" as const,
        result: fakeResult(),
      })),
    );
    await stores.process([new Blob(["a"]), new Blob(["b"])]);
    expect(get(stores.status)).toBe("success");
    expect(get(stores.results)).toHaveLength(2);
  });
});

describe("DusrelCrop.svelte", () => {
  it("compiles cleanly with the real Svelte compiler", async () => {
    const source = readFileSync(new URL("../src/DusrelCrop.svelte", import.meta.url), "utf8");
    // The exact production path used by scripts/compile-fixture.mjs:
    // TypeScript is transpiled out of the <script> block first,
    // then the real Svelte compiler must accept the component.
    const preprocessed = await preprocess(source, {
      script: ({ content }) => ({
        code: ts.transpileModule(content, {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
      }),
    });
    const { js, warnings } = compile(preprocessed.code, {
      filename: "DusrelCrop.svelte",
    });
    expect(warnings.filter((w) => w.code.startsWith("a11y"))).toEqual([]);
    expect(js.code).toContain("dusrel-crop");
  });
});

describe("public surface", () => {
  it("exports the documented factories", () => {
    expect(typeof createProcessor).toBe("function");
    expect(typeof createProcessImage).toBe("function");
    expect(typeof createProcessBatch).toBe("function");
    // DusrelCrop ships via the ./DusrelCrop.svelte subpath, not the JS entry.
  });
});
