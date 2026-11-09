import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-jxl: the libjxl WASM artifacts
// committed in packages/codecs/jxl/codec (built by the wasm-build
// workflow from native/jxl, libjxl v0.11.2) encode and decode actual
// pixels in all three engines. Browsers cannot natively decode JXL
// (that is the point of this package), so proof is roundtrip-based.
const wrapperBundle = readFileSync(
  new URL("../../packages/codecs/jxl/dist/index.js", import.meta.url),
  "utf8",
);
const encJs = readFileSync(
  new URL("../../packages/codecs/jxl/codec/jxl_enc.js", import.meta.url),
  "utf8",
);
const decJs = readFileSync(
  new URL("../../packages/codecs/jxl/codec/jxl_dec.js", import.meta.url),
  "utf8",
);
const encWasm = readFileSync(
  new URL("../../packages/codecs/jxl/codec/jxl_enc.wasm", import.meta.url),
);
const decWasm = readFileSync(
  new URL("../../packages/codecs/jxl/codec/jxl_dec.wasm", import.meta.url),
);

async function loadCodec(page: Page) {
  await page.evaluate(
    ([wrapper, ejs, djs, ewasm, dwasm]) => {
      const url = (content: string | Uint8Array, type: string) =>
        URL.createObjectURL(new Blob([content as BlobPart], { type }));
      (window as unknown as { __jxlAssets: Record<string, string> }).__jxlAssets = {
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
      __jxlAssets: Record<string, string>;
      __jxl: typeof import("../../packages/codecs/jxl/src/index.js");
    };
    const mod = (await import(
      w.__jxlAssets["wrapperUrl"]!
    )) as typeof import("../../packages/codecs/jxl/src/index.js");
    mod.setCodecAssets({
      encodeJsUrl: w.__jxlAssets["encodeJsUrl"],
      encodeWasmUrl: w.__jxlAssets["encodeWasmUrl"],
      decodeJsUrl: w.__jxlAssets["decodeJsUrl"],
      decodeWasmUrl: w.__jxlAssets["decodeWasmUrl"],
    });
    w.__jxl = mod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadCodec(page);
});

test("libjxl lossless roundtrip is pixel-exact, including alpha", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __jxl: jxl } = window as unknown as {
      __jxl: typeof import("../../packages/codecs/jxl/src/index.js");
    };
    const data = new ImageData(16, 16);
    for (let p = 0; p < 16 * 16; p++) {
      data.data[p * 4] = (p * 37) % 256;
      data.data[p * 4 + 1] = (p * 91) % 256;
      data.data[p * 4 + 2] = (p * 53) % 256;
      data.data[p * 4 + 3] = 128 + (p % 128);
    }
    const encoded = new Uint8Array(await jxl.encode(data, { lossless: true }));
    const decoded = await jxl.decode(encoded);
    let exact = decoded.width === 16 && decoded.height === 16;
    if (exact) {
      for (let i = 0; i < data.data.length; i++) {
        if (decoded.data[i] !== data.data[i]) {
          exact = false;
          break;
        }
      }
    }
    return { exact, signature: [encoded[0], encoded[1]], size: encoded.length };
  });
  // A bare JXL codestream starts with the 0xFF 0x0A signature.
  expect(r.signature).toEqual([0xff, 0x0a]);
  expect(r.size).toBeGreaterThan(20);
  expect(r.exact).toBe(true);
});

test("libjxl lossy roundtrip stays within tolerance", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __jxl: jxl } = window as unknown as {
      __jxl: typeof import("../../packages/codecs/jxl/src/index.js");
    };
    const data = new ImageData(32, 32);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const p = (y * 32 + x) * 4;
        data.data[p] = (x * 255) / 31;
        data.data[p + 1] = (y * 255) / 31;
        data.data[p + 2] = 128;
        data.data[p + 3] = 255;
      }
    }
    const encoded = await jxl.encode(data, { quality: 90 });
    const decoded = await jxl.decode(encoded);
    let maxDelta = 0;
    for (let i = 0; i < data.data.length; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(decoded.data[i] - data.data[i]));
    }
    return { width: decoded.width, height: decoded.height, maxDelta };
  });
  expect(r.width).toBe(32);
  expect(r.height).toBe(32);
  expect(r.maxDelta).toBeLessThanOrEqual(16);
});

test("setCodecAssets after first use rebinds to the fresh module instance", async ({ page }) => {
  // Regression: setCodecAssets clears the loader cache, so the next call
  // runs on a NEW WASM module instance. The cwrap'd functions must be
  // bound to that instance — before the fix, the stale binding silently
  // returned 0 bytes (found by the consumer test, 2026-11-09).
  const r = await page.evaluate(async () => {
    const w = window as unknown as {
      __jxlAssets: Record<string, string>;
      __jxl: typeof import("../../packages/codecs/jxl/src/index.js");
    };
    const data = new ImageData(24, 24);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 200;
      data.data[i + 1] = 120;
      data.data[i + 2] = 40;
      data.data[i + 3] = 255;
    }
    const first = new Uint8Array(await w.__jxl.encode(data, { lossless: true }));
    w.__jxl.setCodecAssets({
      encodeJsUrl: w.__jxlAssets["encodeJsUrl"],
      encodeWasmUrl: w.__jxlAssets["encodeWasmUrl"],
      decodeJsUrl: w.__jxlAssets["decodeJsUrl"],
      decodeWasmUrl: w.__jxlAssets["decodeWasmUrl"],
    });
    const second = new Uint8Array(await w.__jxl.encode(data, { lossless: true }));
    const decoded = await w.__jxl.decode(second);
    return { first: first.length, second: second.length, w: decoded.width, h: decoded.height };
  });
  expect(r.first).toBeGreaterThan(0);
  expect(r.second).toBeGreaterThan(0);
  expect(r.w).toBe(24);
  expect(r.h).toBe(24);
});
