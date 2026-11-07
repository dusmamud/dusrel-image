import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Phase 2 close-out proof: the flagship pipeline actually consumes
// the WASM codec packages through the registration factories
// (docs/API_DESIGN.md section 6). Canvas cannot encode AVIF at
// all — an AVIF blob out of the pipeline can only have come from
// @dusrel/image-avif's WASM, registered via codecPlugin.
const coreBundle = readFileSync(
  new URL("../../packages/core/dist/index.js", import.meta.url),
  "utf8",
);
const imageBundle = readFileSync(
  new URL("../../packages/image/dist/index.js", import.meta.url),
  "utf8",
);
const avifBundle = readFileSync(
  new URL("../../packages/codecs/avif/dist/index.js", import.meta.url),
  "utf8",
);
const avifEncJs = readFileSync(
  new URL("../../packages/codecs/avif/codec/avif_enc.js", import.meta.url),
  "utf8",
);
const avifEncWasm = readFileSync(
  new URL("../../packages/codecs/avif/codec/avif_enc.wasm", import.meta.url),
);

type ImageMod = typeof import("../../packages/image/src/index.js");
type AvifMod = typeof import("../../packages/codecs/avif/src/index.js");

async function loadAll(page: Page) {
  const urls = await page.evaluate(
    ([core, image, avif, encJs, encWasm]) => {
      const url = (content: string | Uint8Array, type: string) =>
        URL.createObjectURL(new Blob([content as BlobPart], { type }));
      const assets = {
        coreUrl: url(core!, "text/javascript"),
        imageUrl: url(image!, "text/javascript"),
        avifUrl: url(avif!, "text/javascript"),
        avifEncJs: url(encJs!, "text/javascript"),
        avifEncWasm: url(encWasm!, "application/wasm"),
      };
      (window as unknown as { __assets: Record<string, string> }).__assets = assets;
      return assets;
    },
    [coreBundle, imageBundle, avifBundle, avifEncJs, new Uint8Array(avifEncWasm)] as const,
  );
  await page.addScriptTag({
    content: JSON.stringify({ imports: { "@dusrel/image-core": urls.coreUrl } }),
    type: "importmap",
  });
  await page.evaluate(async () => {
    const w = window as unknown as {
      __assets: Record<string, string>;
      __image: ImageMod;
      __avif: AvifMod;
      __png: Blob;
    };
    const a = w.__assets;
    w.__image = (await import(a["imageUrl"]!)) as ImageMod;
    const avif = (await import(a["avifUrl"]!)) as AvifMod;
    avif.setCodecAssets({ encodeJsUrl: a["avifEncJs"], encodeWasmUrl: a["avifEncWasm"] });
    w.__avif = avif;
    const src = new OffscreenCanvas(96, 64);
    const ctx = src.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 96, 64);
    gradient.addColorStop(0, "#cc5522");
    gradient.addColorStop(1, "#2255cc");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 64);
    w.__png = await src.convertToBlob({ type: "image/png" });
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadAll(page);
});

test("pipeline + codecPlugin encodes real AVIF (a format Canvas cannot produce)", async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const w = window as unknown as { __image: ImageMod; __avif: AvifMod; __png: Blob };
    const result = await w.__image
      .pipeline(w.__png)
      .resize({ width: 48 })
      .use(
        w.__image.codecPlugin({
          mimeType: "image/avif",
          encode: w.__avif.encode,
          options: { quality: 60, speed: 10 },
        }),
      )
      .run();
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const brand = String.fromCharCode(...bytes.subarray(4, 12));
    return {
      type: result.blob.type,
      brand,
      steps: result.report.stepsApplied,
      width: result.report.width,
      size: result.blob.size,
    };
  });
  expect(r.type).toBe("image/avif");
  expect(r.brand).toBe("ftypavif");
  expect(r.width).toBe(48);
  expect(r.size).toBeGreaterThan(50);
  expect(r.steps).toContain("plugin:codec:avif");
});

test("pipeline + imageDataPlugin applies a pixel transform mid-chain", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const w = window as unknown as { __image: ImageMod; __png: Blob };
    const invert = (data: ImageData): ImageData => {
      const out = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
      for (let i = 0; i < out.data.length; i += 4) {
        out.data[i] = 255 - out.data[i]!;
        out.data[i + 1] = 255 - out.data[i + 1]!;
        out.data[i + 2] = 255 - out.data[i + 2]!;
      }
      return out;
    };
    const plain = await w.__image.processImage(w.__png, {});
    const flipped = await w.__image
      .pipeline(w.__png)
      .use(w.__image.imageDataPlugin({ name: "invert", transform: invert }))
      .toFormat("image/png")
      .run();
    const sample = async (blob: Blob) => {
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      return Array.from(ctx.getImageData(2, 2, 1, 1).data);
    };
    const [a, b] = [await sample(plain.blob), await sample(flipped.blob)];
    return { a, b, steps: flipped.report.stepsApplied };
  });
  expect(r.steps).toContain("plugin:invert");
  // Inverted channels (alpha untouched), within PNG roundtrip tolerance.
  expect(Math.abs(r.b[0]! - (255 - r.a[0]!))).toBeLessThanOrEqual(1);
  expect(Math.abs(r.b[1]! - (255 - r.a[1]!))).toBeLessThanOrEqual(1);
  expect(Math.abs(r.b[2]! - (255 - r.a[2]!))).toBeLessThanOrEqual(1);
  expect(r.b[3]).toBe(255);
});
