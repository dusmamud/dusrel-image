import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Loads the BUILT @dusrel/image bundle (with @dusrel/image-core wired in
// through an import map, exactly like a real web app resolves it) and
// exercises easy mode, the fluent pipeline and the fallback policies.
const coreBundle = readFileSync(
  new URL("../../packages/core/dist/index.js", import.meta.url),
  "utf8",
);
const imageBundle = readFileSync(
  new URL("../../packages/image/dist/index.js", import.meta.url),
  "utf8",
);

async function loadImagePackage(page: Page) {
  const urls = await page.evaluate(
    ([core, image]) => {
      const coreUrl = URL.createObjectURL(new Blob([core], { type: "text/javascript" }));
      const imageUrl = URL.createObjectURL(new Blob([image], { type: "text/javascript" }));
      return { coreUrl, imageUrl };
    },
    [coreBundle, imageBundle] as const,
  );
  await page.addScriptTag({
    content: JSON.stringify({ imports: { "@dusrel/image-core": urls.coreUrl } }),
    type: "importmap",
  });
  return page.evaluate(async (imageUrl: string) => {
    const mod = (await import(imageUrl)) as typeof import("../../packages/image/src/index.js");
    (window as unknown as { __dusrelImage: typeof mod }).__dusrelImage = mod;
  }, urls.imageUrl);
}

async function makePng(page: Page, width: number, height: number): Promise<void> {
  await page.evaluate(
    ([w, h]) => {
      const src = new OffscreenCanvas(w!, h!);
      const ctx = src.getContext("2d")!;
      const gradient = ctx.createLinearGradient(0, 0, w!, h!);
      gradient.addColorStop(0, "#22cc88");
      gradient.addColorStop(1, "#2244cc");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w!, h!);
      return src.convertToBlob({ type: "image/png" }).then((blob) => {
        (window as unknown as { __png: Blob }).__png = blob;
      });
    },
    [width, height] as const,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadImagePackage(page);
  await makePng(page, 400, 200);
});

test("easy mode: one call resizes, converts and reports savings", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __dusrelImage: pkg, __png: png } = window as unknown as {
      __dusrelImage: typeof import("../../packages/image/src/index.js");
      __png: Blob;
    };
    const out = await pkg.processImage(png, {
      format: "image/jpeg",
      quality: 0.8,
      resize: { width: 200 },
    });
    return {
      width: out.width,
      height: out.height,
      format: out.format,
      savings: out.report.savingsRatio ?? -1,
      engine: out.report.engine,
      steps: out.report.stepsApplied,
    };
  });
  expect(r.width).toBe(200);
  expect(r.height).toBe(100);
  expect(r.format).toBe("image/jpeg");
  expect(r.engine).toBe("canvas");
  expect(r.steps).toContain("resize");
  expect(r.savings).toBeGreaterThan(0);
});

test("fluent pipeline: crop + rotate 90 swaps dimensions in one pass", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __dusrelImage: pkg, __png: png } = window as unknown as {
      __dusrelImage: typeof import("../../packages/image/src/index.js");
      __png: Blob;
    };
    const out = await pkg
      .pipeline(png)
      .crop({ x: 0, y: 0, width: 200, height: 200 })
      .rotate(90)
      .toFormat("image/png")
      .run();
    return { width: out.width, height: out.height, steps: out.report.stepsApplied };
  });
  // crop 200x200, rotate 90 -> still 200x200; use asymmetric crop instead below
  expect(r.width).toBe(200);
  expect(r.height).toBe(200);
  expect(r.steps).toContain("crop");
  expect(r.steps).toContain("rotate");
});

test("fluent pipeline: rotate 90 on the full frame swaps width and height", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __dusrelImage: pkg, __png: png } = window as unknown as {
      __dusrelImage: typeof import("../../packages/image/src/index.js");
      __png: Blob;
    };
    const out = await pkg.pipeline(png).rotate(90).toFormat("image/png").run();
    return { width: out.width, height: out.height };
  });
  expect(r.width).toBe(200);
  expect(r.height).toBe(400);
});

test("fallback return-original hands back the untouched input on failure", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __dusrelImage: pkg } = window as unknown as {
      __dusrelImage: typeof import("../../packages/image/src/index.js");
    };
    const garbage = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: "image/png" });
    const out = await pkg.processImage(garbage, { fallback: "return-original" });
    return { size: out.sizeBytes, steps: out.report.stepsApplied, fallbacks: out.report.fallbacks };
  });
  expect(r.size).toBe(5);
  expect(r.steps).toEqual(["fallback:return-original"]);
  expect(r.fallbacks).toContain("return-original");
});

test("plugin step runs inside the pipeline and is named in the report", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __dusrelImage: pkg, __png: png } = window as unknown as {
      __dusrelImage: typeof import("../../packages/image/src/index.js");
      __png: Blob;
    };
    const tag = {
      name: "tagger",
      apply: async (blob: Blob) => new Blob([await blob.arrayBuffer()], { type: blob.type }),
    };
    const out = await pkg.pipeline(png).resize({ width: 100 }).use(tag).toFormat("image/png").run();
    return { width: out.width, steps: out.report.stepsApplied };
  });
  expect(r.width).toBe(100);
  expect(r.steps).toContain("plugin:tagger");
});

test("processBatch: bounded batch with a bad item collected as a value", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __dusrelImage: pkg, __png: png } = window as unknown as {
      __dusrelImage: typeof import("../../packages/image/src/index.js");
      __png: Blob;
    };
    const garbage = new Blob([new Uint8Array([9, 9, 9])], { type: "image/png" });
    const events: number[] = [];
    const results = await pkg.processBatch([png, garbage, png], {
      format: "image/webp",
      resize: { width: 50 },
      onBatchProgress: (e) => events.push(e.completed),
    });
    return {
      statuses: results.map((x) => x.status),
      widths: results.map((x) => (x.status === "fulfilled" ? x.result.width : -1)),
      events,
      errorCode: (() => {
        const bad = results[1];
        return bad && bad.status === "rejected" ? (bad.error as { code?: string }).code : undefined;
      })(),
    };
  });
  expect(r.statuses).toEqual(["fulfilled", "rejected", "fulfilled"]);
  expect(r.widths).toEqual([50, -1, 50]);
  expect(r.events).toEqual([1, 2, 3]);
  expect(r.errorCode).toBe("decode-failed");
});
