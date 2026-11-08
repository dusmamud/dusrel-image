import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Plugin API conformance proof (docs/API_DESIGN.md section 6,
// ADR-0007) in real browsers:
//  1. easy-mode plugins actually run (they were silently dropped
//     before stabilisation);
//  2. a registered codec serves as the output `format`;
//  3. an unregistered format fails with the typed error;
//  4. a throwing plugin surfaces as plugin-failed;
//  5. pipeline .codec() sets blob type AND report format.
const coreBundle = readFileSync(
  new URL("../../packages/core/dist/index.js", import.meta.url),
  "utf8",
);
const imageBundle = readFileSync(
  new URL("../../packages/image/dist/index.js", import.meta.url),
  "utf8",
);

type ImageMod = typeof import("../../packages/image/src/index.js");

async function loadAll(page: Page) {
  const urls = await page.evaluate(
    ([core, image]) => {
      const url = (content: string) =>
        URL.createObjectURL(new Blob([content], { type: "text/javascript" }));
      const assets = { coreUrl: url(core!), imageUrl: url(image!) };
      (window as unknown as { __assets: Record<string, string> }).__assets = assets;
      return assets;
    },
    [coreBundle, imageBundle] as const,
  );
  await page.addScriptTag({
    content: JSON.stringify({ imports: { "@dusrel/image-core": urls.coreUrl } }),
    type: "importmap",
  });
  await page.evaluate(async () => {
    const w = window as unknown as { __assets: Record<string, string>; __image: ImageMod };
    w.__image = (await import(w.__assets["imageUrl"]!)) as ImageMod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadAll(page);
});

// A 16x16 opaque red PNG, drawn in-page (ImageData exists here).
const MAKE_INPUT = `
  const canvas = new OffscreenCanvas(16, 16);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgb(255, 0, 0)";
  ctx.fillRect(0, 0, 16, 16);
  const input = await canvas.convertToBlob({ type: "image/png" });
`;

test("plugins: easy-mode plugin steps run and are reported", async ({ page }) => {
  const r = await page.evaluate(async (makeInput) => {
    const img = (window as unknown as { __image: ImageMod }).__image;
    const input = await new Function(`return (async () => { ${makeInput}; return input; })()`)();
    const invert = img.imageDataPlugin({
      name: "invert",
      transform: (data) => {
        const out = new ImageData(data.width, data.height);
        for (let i = 0; i < data.data.length; i += 4) {
          out.data[i] = 255 - data.data[i]!;
          out.data[i + 1] = 255 - data.data[i + 1]!;
          out.data[i + 2] = 255 - data.data[i + 2]!;
          out.data[i + 3] = 255;
        }
        return out;
      },
    });
    const result = await img.processImage(input, { format: "image/png", plugins: [invert] });
    const bitmap = await createImageBitmap(result.blob);
    const c = new OffscreenCanvas(16, 16);
    const cx = c.getContext("2d")!;
    cx.drawImage(bitmap, 0, 0);
    const px = cx.getImageData(0, 0, 1, 1).data;
    return {
      steps: result.report.stepsApplied,
      format: result.report.format,
      pixel: [px[0], px[1], px[2]],
    };
  }, MAKE_INPUT);
  expect(r.steps).toContain("plugin:invert");
  expect(r.format).toBe("image/png");
  expect(r.pixel).toEqual([0, 255, 255]); // red inverted = cyan
});

test("plugins: a registered codec serves as the output format", async ({ page }) => {
  const r = await page.evaluate(async (makeInput) => {
    const img = (window as unknown as { __image: ImageMod }).__image;
    const input = await new Function(`return (async () => { ${makeInput}; return input; })()`)();
    // A stand-in codec: returns a fixed signature payload.
    const fake = {
      mimeType: "image/x-fake",
      encode: () => new Uint8Array([0xfa, 0x4e, 0x00, 0x01]),
    };
    const result = await img.processImage(input, { format: "image/x-fake", codecs: [fake] });
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    return {
      blobType: result.blob.type,
      format: result.format,
      reportFormat: result.report.format,
      steps: result.report.stepsApplied,
      signature: [...bytes.slice(0, 2)],
    };
  }, MAKE_INPUT);
  expect(r.blobType).toBe("image/x-fake");
  expect(r.format).toBe("image/x-fake");
  expect(r.reportFormat).toBe("image/x-fake");
  expect(r.steps).toContain("codec:x-fake");
  expect(r.signature).toEqual([0xfa, 0x4e]);
});

test("plugins: unregistered format and throwing plugin produce typed errors", async ({ page }) => {
  const r = await page.evaluate(async (makeInput) => {
    const img = (window as unknown as { __image: ImageMod }).__image;
    const input = await new Function(`return (async () => { ${makeInput}; return input; })()`)();
    let unregistered = "";
    try {
      await img.processImage(input, { format: "image/avif" });
    } catch (e) {
      unregistered = `${(e as { code?: string }).code}`;
    }
    let pluginFailed = "";
    try {
      await img.processImage(input, {
        plugins: [
          {
            name: "explode",
            apply: async () => {
              throw new Error("kaboom");
            },
          },
        ],
      });
    } catch (e) {
      pluginFailed = `${(e as { code?: string }).code}:${(e as Error).message}`;
    }
    return { unregistered, pluginFailed };
  }, MAKE_INPUT);
  expect(r.unregistered).toBe("unsupported-format");
  expect(r.pluginFailed).toContain("plugin-failed");
  expect(r.pluginFailed).toContain("explode");
  expect(r.pluginFailed).toContain("kaboom");
});

test("plugins: pipeline .codec() sets the blob type and the report format", async ({ page }) => {
  const r = await page.evaluate(async (makeInput) => {
    const img = (window as unknown as { __image: ImageMod }).__image;
    const input = await new Function(`return (async () => { ${makeInput}; return input; })()`)();
    const fake = {
      mimeType: "image/x-fake",
      encode: () => new Uint8Array([0xfa, 0x4e]),
    };
    const result = await img.pipeline(input).resize({ width: 8, height: 8 }).codec(fake).run();
    return {
      blobType: result.blob.type,
      format: result.format,
      reportFormat: result.report.format,
      width: result.width,
    };
  }, MAKE_INPUT);
  expect(r.blobType).toBe("image/x-fake");
  expect(r.format).toBe("image/x-fake");
  expect(r.reportFormat).toBe("image/x-fake");
  expect(r.width).toBe(8);
});
