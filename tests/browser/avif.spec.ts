import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-avif: the libavif + libaom WASM
// artifacts committed in packages/codecs/avif/codec (built by the
// wasm-build workflow from native/avif, and functionally smoke-gated
// inside that build) encode and decode actual pixels.
const wrapperBundle = readFileSync(
  new URL("../../packages/codecs/avif/dist/index.js", import.meta.url),
  "utf8",
);
const encJs = readFileSync(
  new URL("../../packages/codecs/avif/codec/avif_enc.js", import.meta.url),
  "utf8",
);
const decJs = readFileSync(
  new URL("../../packages/codecs/avif/codec/avif_dec.js", import.meta.url),
  "utf8",
);
const encWasm = readFileSync(
  new URL("../../packages/codecs/avif/codec/avif_enc.wasm", import.meta.url),
);
const decWasm = readFileSync(
  new URL("../../packages/codecs/avif/codec/avif_dec.wasm", import.meta.url),
);

async function loadCodec(page: Page) {
  await page.evaluate(
    ([wrapper, ejs, djs, ewasm, dwasm]) => {
      const url = (content: string | Uint8Array, type: string) =>
        URL.createObjectURL(new Blob([content as BlobPart], { type }));
      (window as unknown as { __avifAssets: Record<string, string> }).__avifAssets = {
        wrapperUrl: url(wrapper!, "text/javascript"),
        encodeJsUrl: url(ejs!, "text/javascript"),
        encodeWasmUrl: url(ewasm!, "application/wasm"),
        decodeJsUrl: url(djs!, "text/javascript"),
        decodeWasmUrl: url(dwasm!, "application/wasm"),
      };
    },
    [wrapperBundle, encJs, decJs, new Uint8Array(encWasm), new Uint8Array(decWasm)] as const,
  );
  await page.evaluate(async () => {
    const w = window as unknown as {
      __avifAssets: Record<string, string>;
      __avif: typeof import("../../packages/codecs/avif/src/index.js");
    };
    const mod = (await import(
      w.__avifAssets["wrapperUrl"]!
    )) as typeof import("../../packages/codecs/avif/src/index.js");
    mod.setCodecAssets({
      encodeJsUrl: w.__avifAssets["encodeJsUrl"],
      encodeWasmUrl: w.__avifAssets["encodeWasmUrl"],
      decodeJsUrl: w.__avifAssets["decodeJsUrl"],
      decodeWasmUrl: w.__avifAssets["decodeWasmUrl"],
    });
    w.__avif = mod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadCodec(page);
});

test("libaom encode: ftyp/avif brand and plausible size", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __avif: avif } = window as unknown as {
      __avif: typeof import("../../packages/codecs/avif/src/index.js");
    };
    const data = new ImageData(48, 32);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 30;
      data.data[i + 1] = 200;
      data.data[i + 2] = 90;
      data.data[i + 3] = 255;
    }
    const out = new Uint8Array(await avif.encode(data, { quality: 60, speed: 10 }));
    const brand = String.fromCharCode(...out.slice(4, 12));
    return { brand, size: out.length };
  });
  expect(r.brand).toBe("ftypavif");
  expect(r.size).toBeGreaterThan(40);
});

test("libaom roundtrip: gradient survives encode -> our decode", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __avif: avif } = window as unknown as {
      __avif: typeof import("../../packages/codecs/avif/src/index.js");
    };
    const W = 16;
    const H = 16;
    const data = new ImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        data.data[i] = x * 16;
        data.data[i + 1] = y * 16;
        data.data[i + 2] = 128;
        data.data[i + 3] = 255;
      }
    }
    const encoded = await avif.encode(data, { quality: 90, speed: 10, pixelFormat: "444" });
    const decoded = await avif.decode(encoded);
    const last = (W * H - 1) * 4;
    return {
      width: decoded.width,
      height: decoded.height,
      corner: [decoded.data[0], decoded.data[1], decoded.data[2]],
      opposite: [decoded.data[last], decoded.data[last + 1], decoded.data[last + 2]],
    };
  });
  expect(r.width).toBe(16);
  expect(r.height).toBe(16);
  expect(Math.abs(r.corner[0]! - 0)).toBeLessThan(24);
  expect(Math.abs(r.corner[1]! - 0)).toBeLessThan(24);
  expect(Math.abs(r.opposite[0]! - 240)).toBeLessThan(24);
  expect(Math.abs(r.opposite[1]! - 240)).toBeLessThan(24);
});

test("interop: the browser itself decodes our AVIF (where the platform supports AVIF)", async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const { __avif: avif } = window as unknown as {
      __avif: typeof import("../../packages/codecs/avif/src/index.js");
    };
    const data = new ImageData(20, 12);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 250;
      data.data[i + 1] = 180;
      data.data[i + 3] = 255;
    }
    const encoded = await avif.encode(data, { quality: 80, speed: 10 });
    try {
      const bitmap = await createImageBitmap(
        new Blob([encoded as BlobPart], { type: "image/avif" }),
      );
      return { supported: true, width: bitmap.width, height: bitmap.height };
    } catch {
      return { supported: false, width: 0, height: 0 };
    }
  });
  test.skip(!r.supported, "this platform/browser build cannot decode AVIF natively");
  expect(r.width).toBe(20);
  expect(r.height).toBe(12);
});
