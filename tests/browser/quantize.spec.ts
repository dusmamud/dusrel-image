import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-quantize: the committed
// quantizr WASM (built by the wasm-build workflow from native/rust)
// reduces a many-colour image to a bounded palette, and the palette
// actually describes the image (bounded distance, sane expansion).
const wrapperBundle = readFileSync(
  new URL("../../packages/codecs/quantize/dist/index.js", import.meta.url),
  "utf8",
);
const glueJs = readFileSync(
  new URL("../../packages/codecs/quantize/codec/quantize.js", import.meta.url),
  "utf8",
);
const glueWasm = readFileSync(
  new URL("../../packages/codecs/quantize/codec/quantize.wasm", import.meta.url),
);

type QuantizeMod = typeof import("../../packages/codecs/quantize/src/index.js");

async function loadPackage(page: Page) {
  await page.evaluate(
    ([wrapper, js, wasm]) => {
      const url = (content: string | Uint8Array, type: string) =>
        URL.createObjectURL(new Blob([content as BlobPart], { type }));
      (window as unknown as { __assets: Record<string, string> }).__assets = {
        wrapperUrl: url(wrapper!, "text/javascript"),
        jsUrl: url(js!, "text/javascript"),
        wasmUrl: url(wasm!, "application/wasm"),
      };
    },
    [wrapperBundle, glueJs, new Uint8Array(glueWasm)] as const,
  );
  await page.evaluate(async () => {
    const w = window as unknown as { __assets: Record<string, string>; __qz: QuantizeMod };
    const mod = (await import(w.__assets["wrapperUrl"]!)) as QuantizeMod;
    mod.setCodecAssets({ jsUrl: w.__assets["jsUrl"], wasmUrl: w.__assets["wasmUrl"] });
    w.__qz = mod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadPackage(page);
});

test("quantize bounds the palette and the expansion stays close", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __qz: qz } = window as unknown as { __qz: QuantizeMod };
    const src = (() => {
      const d = new ImageData(64, 64);
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const i = (y * 64 + x) * 4;
          d.data[i] = (x * 4) & 0xff;
          d.data[i + 1] = (y * 4) & 0xff;
          d.data[i + 2] = ((x + y) * 2) & 0xff;
          d.data[i + 3] = 255;
        }
      }
      return d;
    })();
    const result = await qz.quantize(src, { maxColors: 32 });
    const expanded = qz.resultToImageData(result);
    let totalDiff = 0;
    for (let i = 0; i < src.data.length; i += 4) {
      totalDiff +=
        Math.abs(expanded.data[i]! - src.data[i]!) +
        Math.abs(expanded.data[i + 1]! - src.data[i + 1]!) +
        Math.abs(expanded.data[i + 2]! - src.data[i + 2]!);
    }
    const distinct = new Set<number>();
    for (let i = 0; i < expanded.data.length; i += 4) {
      distinct.add(
        (expanded.data[i]! << 24) |
          (expanded.data[i + 1]! << 16) |
          (expanded.data[i + 2]! << 8) |
          expanded.data[i + 3]!,
      );
    }
    return {
      colorCount: result.colorCount,
      indices: result.indices.length,
      error: result.error,
      meanDiff: totalDiff / (64 * 64 * 3),
      distinct: distinct.size,
    };
  });
  expect(r.colorCount).toBeLessThanOrEqual(32);
  expect(r.colorCount).toBeGreaterThan(1);
  expect(r.indices).toBe(64 * 64);
  expect(Number.isFinite(r.error)).toBe(true);
  expect(r.distinct).toBeLessThanOrEqual(32);
  expect(r.meanDiff).toBeLessThan(32);
});

test("quantizeToImageData honours maxColors on a solid image", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __qz: qz } = window as unknown as { __qz: QuantizeMod };
    const src = new ImageData(8, 8);
    for (let i = 0; i < src.data.length; i += 4) {
      src.data[i] = 90;
      src.data[i + 1] = 160;
      src.data[i + 2] = 30;
      src.data[i + 3] = 255;
    }
    const out = await qz.quantizeToImageData(src, { maxColors: 4 });
    return { first: Array.from(out.data.subarray(0, 4)), w: out.width, h: out.height };
  });
  expect(r.w).toBe(8);
  expect(r.h).toBe(8);
  expect(r.first).toEqual([90, 160, 30, 255]);
});
