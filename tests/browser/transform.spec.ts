import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-transform: the exact pixel
// ops are already unit-proven in Node; here the canvas-backed
// arbitrary rotation runs in real engines, and the package drops
// into @dusrel/image's pipeline via imageDataPlugin (ImageData is
// structurally a PixelData — no adapter code needed).
const transformBundle = readFileSync(
  new URL("../../packages/features/transform/dist/index.js", import.meta.url),
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

type TransformMod = typeof import("../../packages/features/transform/src/index.js");
type ImageMod = typeof import("../../packages/image/src/index.js");

async function loadAll(page: Page) {
  const urls = await page.evaluate(
    ([t, c, i]) => {
      const url = (content: string, type: string) =>
        URL.createObjectURL(new Blob([content], { type }));
      const assets = {
        tUrl: url(t!, "text/javascript"),
        coreUrl: url(c!, "text/javascript"),
        imageUrl: url(i!, "text/javascript"),
      };
      (window as unknown as { __assets: Record<string, string> }).__assets = assets;
      return assets;
    },
    [transformBundle, coreBundle, imageBundle] as const,
  );
  await page.addScriptTag({
    content: JSON.stringify({ imports: { "@dusrel/image-core": urls.coreUrl } }),
    type: "importmap",
  });
  await page.evaluate(async () => {
    const w = window as unknown as {
      __assets: Record<string, string>;
      __t: TransformMod;
      __image: ImageMod;
    };
    w.__t = (await import(w.__assets["tUrl"]!)) as TransformMod;
    w.__image = (await import(w.__assets["imageUrl"]!)) as ImageMod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadAll(page);
});

test("rotateArbitrary 45° grows the canvas and fills corners with the background", async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const { __t: t } = window as unknown as { __t: TransformMod };
    const src = new ImageData(20, 10);
    for (let i = 0; i < src.data.length; i += 4) {
      src.data[i] = 200;
      src.data[i + 3] = 255;
    }
    const out = t.rotateArbitrary(src, 45, { r: 0, g: 0, b: 255 });
    const corner = Array.from(out.data.subarray(0, 4));
    return { w: out.width, h: out.height, corner };
  });
  // Rotated bounds of a 20x10 rect at 45°: ceil(20c + 10s) = 22.
  expect(r.w).toBe(22);
  expect(r.h).toBe(22);
  expect(r.corner).toEqual([0, 0, 255, 255]);
});

test("pipeline integration: flip via imageDataPlugin flips the output", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const w = window as unknown as { __t: TransformMod; __image: ImageMod };
    const src = new OffscreenCanvas(4, 1);
    const ctx = src.getContext("2d")!;
    ctx.fillStyle = "rgb(255, 0, 0)";
    ctx.fillRect(0, 0, 2, 1);
    ctx.fillStyle = "rgb(0, 0, 255)";
    ctx.fillRect(2, 0, 2, 1);
    const png = await src.convertToBlob({ type: "image/png" });
    const result = await w.__image
      .pipeline(png)
      .use(w.__image.imageDataPlugin({ name: "flip", transform: (d) => w.__t.flipHorizontal(d) }))
      .run();
    const bitmap = await createImageBitmap(result.blob);
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    const cctx = c.getContext("2d")!;
    cctx.drawImage(bitmap, 0, 0);
    const left = Array.from(cctx.getImageData(0, 0, 1, 1).data);
    const right = Array.from(cctx.getImageData(3, 0, 1, 1).data);
    return { left, right };
  });
  expect(r.left).toEqual([0, 0, 255, 255]);
  expect(r.right).toEqual([255, 0, 0, 255]);
});
