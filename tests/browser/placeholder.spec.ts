import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-placeholder: the built
// bundle (self-contained, no dependencies) decodes reference
// hashes and round-trips encodes in all three engines.
// Encode byte-exactness against the reference implementations
// is pinned by the Node unit tests (oracle vectors); browser
// assertions use a ±2 channel tolerance because engines'
// Math.cos can differ in the last ulp.
const bundle = readFileSync(
  new URL("../../packages/features/placeholder/dist/index.js", import.meta.url),
  "utf8",
);

type PlaceholderModule = typeof import("../../packages/features/placeholder/src/index.js");

async function evaluateWithModule<T>(
  page: Page,
  fn: (m: PlaceholderModule) => T | Promise<T>,
): Promise<T> {
  return page.evaluate(
    async ({ code, fnSource }) => {
      const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      const m = (await import(url)) as PlaceholderModule;
      const f = new Function("m", `return (${fnSource})(m)`) as (
        m: PlaceholderModule,
      ) => T | Promise<T>;
      return f(m);
    },
    { code: bundle, fnSource: fn.toString() },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
});

test("thumbhash: decodes the reference gradient hash in the browser", async ({ page }) => {
  const r = await evaluateWithModule(page, (m) => {
    const hash = m.thumbHashFromBase64("4AcORKJxh3eAiHeHiIdxcBf3iA==");
    const out = m.decodeThumbHash(hash);
    const at = (x: number, y: number) =>
      Array.from(out.data.slice((y * out.width + x) * 4, (y * out.width + x) * 4 + 4));
    return {
      width: out.width,
      height: out.height,
      aspect: m.thumbHashAspectRatio(hash),
      first: at(0, 0),
      lastRowFirst: at(0, out.height - 1),
    };
  });
  expect(r.width).toBe(32);
  expect(r.height).toBe(18);
  expect(r.aspect).toBeCloseTo(1.75, 10);
  // Reference decoder output: [0, 0, 151, 255] / [0, 255, 128, 255]
  for (let c = 0; c < 4; c++) {
    expect(Math.abs((r.first[c] as number) - [0, 0, 151, 255][c])).toBeLessThanOrEqual(2);
    expect(Math.abs((r.lastRowFirst[c] as number) - [0, 255, 128, 255][c])).toBeLessThanOrEqual(2);
  }
});

test("blurhash: decodes the reference string in the browser", async ({ page }) => {
  const r = await evaluateWithModule(page, (m) => {
    const hash = "LRI5u53.a|?Z_e9~fQredLeqfQeq";
    const out = m.decodeBlurHash(hash, 8, 8);
    const at = (x: number, y: number) =>
      Array.from(out.data.slice((y * out.width + x) * 4, (y * out.width + x) * 4 + 4));
    return {
      valid: m.isValidBlurHash(hash),
      components: m.blurHashComponents(hash),
      first: at(0, 0),
      last: at(7, 7),
    };
  });
  expect(r.valid).toBe(true);
  expect(r.components).toEqual({ componentX: 4, componentY: 3 });
  // Reference decoder output at 8x8: [160, 102, 181, 255] / [128, 137, 78, 255]
  for (let c = 0; c < 4; c++) {
    expect(Math.abs((r.first[c] as number) - [160, 102, 181, 255][c])).toBeLessThanOrEqual(2);
    expect(Math.abs((r.last[c] as number) - [128, 137, 78, 255][c])).toBeLessThanOrEqual(2);
  }
});

test("placeholder: in-page encode → decode round-trip keeps aspect and rough colours", async ({
  page,
}) => {
  const r = await evaluateWithModule(page, (m) => {
    const w = 8;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = Math.round((x / (w - 1)) * 255);
        data[i + 1] = Math.round((y / (h - 1)) * 255);
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
    }
    const pixels = { data, width: w, height: h };
    const thumb = m.encodeThumbHash(pixels);
    const thumbOut = m.decodeThumbHash(thumb);
    const blur = m.encodeBlurHash(pixels);
    return {
      thumbAspect: m.thumbHashAspectRatio(thumb),
      thumbSize: [thumbOut.width, thumbOut.height],
      blurLength: blur.length,
      blurValid: m.isValidBlurHash(blur),
      average: m.averageColor(pixels),
    };
  });
  expect(r.thumbAspect).toBeCloseTo(1.75, 10);
  expect(r.thumbSize).toEqual([32, 18]);
  expect(r.blurLength).toBe(28);
  expect(r.blurValid).toBe(true);
  expect(r.average).toEqual({ r: 128, g: 128, b: 128, a: 255 });
});
