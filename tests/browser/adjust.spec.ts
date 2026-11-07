import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-adjust: the maths is
// unit-proven in Node with exact values; here the package runs
// inside @dusrel/image's pipeline in real engines (and the blur's
// multi-pass loop exercises a non-trivial image end to end).
const adjustBundle = readFileSync(
  new URL("../../packages/features/adjust/dist/index.js", import.meta.url),
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

type AdjustMod = typeof import("../../packages/features/adjust/src/index.js");
type ImageMod = typeof import("../../packages/image/src/index.js");

async function loadAll(page: Page) {
  const urls = await page.evaluate(
    ([a, c, i]) => {
      const url = (content: string) =>
        URL.createObjectURL(new Blob([content], { type: "text/javascript" }));
      const assets = { aUrl: url(a!), coreUrl: url(c!), imageUrl: url(i!) };
      (window as unknown as { __assets: Record<string, string> }).__assets = assets;
      return assets;
    },
    [adjustBundle, coreBundle, imageBundle] as const,
  );
  await page.addScriptTag({
    content: JSON.stringify({ imports: { "@dusrel/image-core": urls.coreUrl } }),
    type: "importmap",
  });
  await page.evaluate(async () => {
    const w = window as unknown as {
      __assets: Record<string, string>;
      __a: AdjustMod;
      __image: ImageMod;
    };
    w.__a = (await import(w.__assets["aUrl"]!)) as AdjustMod;
    w.__image = (await import(w.__assets["imageUrl"]!)) as ImageMod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadAll(page);
});

test("pipeline: grayscale adjustment produces equal channels", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const w = window as unknown as { __a: AdjustMod; __image: ImageMod };
    const src = new OffscreenCanvas(8, 8);
    const ctx = src.getContext("2d")!;
    ctx.fillStyle = "rgb(255, 0, 0)";
    ctx.fillRect(0, 0, 8, 8);
    const png = await src.convertToBlob({ type: "image/png" });
    const result = await w.__image
      .pipeline(png)
      .use(w.__image.imageDataPlugin({ name: "gray", transform: (d) => w.__a.grayscale(d) }))
      .run();
    const bitmap = await createImageBitmap(result.blob);
    const c = new OffscreenCanvas(8, 8);
    const cctx = c.getContext("2d")!;
    cctx.drawImage(bitmap, 0, 0);
    return Array.from(cctx.getImageData(4, 4, 1, 1).data);
  });
  expect(r).toEqual([54, 54, 54, 255]); // Rec.709 luminance of pure red
});

test("gaussianBlur softens a hard edge (midpoint lands between the two colours)", async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const { __a: a } = window as unknown as { __a: AdjustMod };
    const data = new ImageData(16, 4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        data.data[i] = x < 8 ? 0 : 255;
        data.data[i + 3] = 255;
      }
    }
    const out = a.gaussianBlur(data, 2);
    const edge = out.data[(1 * 16 + 8) * 4]!;
    const far = out.data[(1 * 16 + 15) * 4]!;
    return { edge, far };
  });
  expect(r.edge).toBeGreaterThan(100);
  expect(r.edge).toBeLessThan(230);
  expect(r.far).toBe(255);
});
