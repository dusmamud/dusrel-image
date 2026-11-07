import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-watermark: text drawing
// needs a real canvas, and the image-mark path is proven inside
// @dusrel/image's pipeline.
const watermarkBundle = readFileSync(
  new URL("../../packages/features/watermark/dist/index.js", import.meta.url),
  "utf8",
);
const coreBundle = readFileSync(
  new URL("../../packages/core/dist/index.js", import.meta.url),
  "utf8",
);
const imageBundle = readFileSync(
  new URL("../../packages/image/dist/index.js", import.meta.url),
  "utf8",
);

type WatermarkMod = typeof import("../../packages/features/watermark/src/index.js");
type ImageMod = typeof import("../../packages/image/src/index.js");

async function loadAll(page: Page) {
  const urls = await page.evaluate(
    ([wm, c, i]) => {
      const url = (content: string) =>
        URL.createObjectURL(new Blob([content], { type: "text/javascript" }));
      const assets = { wmUrl: url(wm!), coreUrl: url(c!), imageUrl: url(i!) };
      (window as unknown as { __assets: Record<string, string> }).__assets = assets;
      return assets;
    },
    [watermarkBundle, coreBundle, imageBundle] as const,
  );
  await page.addScriptTag({
    content: JSON.stringify({ imports: { "@dusrel/image-core": urls.coreUrl } }),
    type: "importmap",
  });
  await page.evaluate(async () => {
    const w = window as unknown as {
      __assets: Record<string, string>;
      __wm: WatermarkMod;
      __image: ImageMod;
    };
    w.__wm = (await import(w.__assets["wmUrl"]!)) as WatermarkMod;
    w.__image = (await import(w.__assets["imageUrl"]!)) as ImageMod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadAll(page);
});

test("text watermark changes only the bottom-right region", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __wm: wm } = window as unknown as { __wm: WatermarkMod };
    const base = new ImageData(200, 100);
    for (let i = 0; i < base.data.length; i += 4) {
      base.data[i] = 30;
      base.data[i + 1] = 30;
      base.data[i + 2] = 30;
      base.data[i + 3] = 255;
    }
    const out = wm.drawTextWatermark(base, "dusrel", {
      position: "bottom-right",
      margin: 8,
      opacity: 1,
      color: "#ffffff",
      font: "700 28px sans-serif",
      scale: 0.4,
    });
    const pixel = (x: number, y: number) => out.data[(y * out.width + x) * 4]!;
    // Scan the bottom-right quadrant for brightened (text) pixels.
    let changed = 0;
    for (let y = 60; y < 100; y++) {
      for (let x = 100; x < 200; x++) {
        if (pixel(x, y) > 100) changed++;
      }
    }
    return { topLeft: pixel(2, 2), changed };
  });
  expect(r.topLeft).toBe(30); // untouched
  expect(r.changed).toBeGreaterThan(20); // text strokes present
});

test("pipeline: image watermark composites a logo mark", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const w = window as unknown as { __wm: WatermarkMod; __image: ImageMod };
    const src = new OffscreenCanvas(40, 40);
    const ctx = src.getContext("2d")!;
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillRect(0, 0, 40, 40);
    const png = await src.convertToBlob({ type: "image/png" });
    const mark = new ImageData(10, 10);
    for (let i = 0; i < mark.data.length; i += 4) {
      mark.data[i] = 255;
      mark.data[i + 3] = 255;
    }
    const result = await w.__image
      .pipeline(png)
      .use(
        w.__image.imageDataPlugin({
          name: "watermark",
          transform: (d) =>
            w.__wm.applyWatermark(d, mark, {
              position: "top-left",
              margin: 0,
              scale: 0.25,
              opacity: 1,
            }),
        }),
      )
      .run();
    const bitmap = await createImageBitmap(result.blob);
    const c = new OffscreenCanvas(40, 40);
    const cctx = c.getContext("2d")!;
    cctx.drawImage(bitmap, 0, 0);
    return {
      marked: Array.from(cctx.getImageData(5, 5, 1, 1).data),
      clean: Array.from(cctx.getImageData(35, 35, 1, 1).data),
    };
  });
  expect(r.marked).toEqual([255, 0, 0, 255]);
  expect(r.clean).toEqual([255, 255, 255, 255]);
});
