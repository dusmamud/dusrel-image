import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-resize: the committed resize
// crate WASM (built by the wasm-build workflow from native/rust)
// resamples with exact nearest blocks, stable lanczos solids, and —
// the headline — no colour bleed from transparent pixels.
const wrapperBundle = readFileSync(
  new URL("../../packages/codecs/resize/dist/index.js", import.meta.url),
  "utf8",
);
const glueJs = readFileSync(
  new URL("../../packages/codecs/resize/codec/resize.js", import.meta.url),
  "utf8",
);
const glueWasm = readFileSync(
  new URL("../../packages/codecs/resize/codec/resize.wasm", import.meta.url),
);

type ResizeMod = typeof import("../../packages/codecs/resize/src/index.js");

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
    const w = window as unknown as { __assets: Record<string, string>; __resize: ResizeMod };
    const mod = (await import(w.__assets["wrapperUrl"]!)) as ResizeMod;
    mod.setCodecAssets({ jsUrl: w.__assets["jsUrl"], wasmUrl: w.__assets["wasmUrl"] });
    w.__resize = mod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadPackage(page);
});

test("nearest upscale replicates exact 2x2 blocks", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __resize: rz } = window as unknown as { __resize: ResizeMod };
    const src = new ImageData(2, 2);
    src.data.set([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
    const out = await rz.resize(src, { width: 4, height: 4, filter: "nearest" });
    const at = (x: number, y: number) =>
      Array.from(out.data.subarray((y * 4 + x) * 4, (y * 4 + x) * 4 + 4));
    return { tl: at(0, 0), tr: at(3, 0), bl: at(0, 3), br: at(3, 3), w: out.width, h: out.height };
  });
  expect(r.w).toBe(4);
  expect(r.h).toBe(4);
  expect(r.tl).toEqual([255, 0, 0, 255]);
  expect(r.tr).toEqual([0, 255, 0, 255]);
  expect(r.bl).toEqual([0, 0, 255, 255]);
  expect(r.br).toEqual([255, 255, 255, 255]);
});

test("premultiplied alpha: transparent green does not bleed into red", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __resize: rz } = window as unknown as { __resize: ResizeMod };
    const src = new ImageData(8, 2);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 8; x++) {
        const i = (y * 8 + x) * 4;
        if (x < 4) {
          src.data[i] = 255;
          src.data[i + 3] = 255;
        } else {
          src.data[i + 1] = 255; // fully transparent GREEN
          src.data[i + 3] = 0;
        }
      }
    }
    const out = await rz.resize(src, { width: 4, height: 1, filter: "lanczos3" });
    const boundary = Array.from(out.data.subarray(4, 8));
    return { boundary };
  });
  // Boundary pixel must stay red-dominant with essentially no green.
  expect(r.boundary[0]).toBeGreaterThan(150);
  expect(r.boundary[1]).toBeLessThanOrEqual(40);
});

test("lanczos3 downscale of a solid colour returns that colour", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __resize: rz } = window as unknown as { __resize: ResizeMod };
    const src = new ImageData(16, 16);
    for (let i = 0; i < src.data.length; i += 4) {
      src.data[i] = 40;
      src.data[i + 1] = 120;
      src.data[i + 2] = 200;
      src.data[i + 3] = 255;
    }
    const out = await rz.resize(src, { width: 5, height: 5 });
    const mid = Array.from(out.data.subarray((2 * 5 + 2) * 4, (2 * 5 + 2) * 4 + 4));
    return { mid, w: out.width, h: out.height };
  });
  expect(r.w).toBe(5);
  expect(r.h).toBe(5);
  expect(r.mid).toEqual([40, 120, 200, 255]);
});
