import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-jpeg: the MozJPEG WASM artifacts
// committed in packages/codecs/jpeg/codec (built by the wasm-build
// workflow from native/mozjpeg) encode and decode actual pixels.
const wrapperBundle = readFileSync(
  new URL("../../packages/codecs/jpeg/dist/index.js", import.meta.url),
  "utf8",
);
const encJs = readFileSync(
  new URL("../../packages/codecs/jpeg/codec/mozjpeg_enc.js", import.meta.url),
  "utf8",
);
const decJs = readFileSync(
  new URL("../../packages/codecs/jpeg/codec/mozjpeg_dec.js", import.meta.url),
  "utf8",
);
const encWasm = readFileSync(
  new URL("../../packages/codecs/jpeg/codec/mozjpeg_enc.wasm", import.meta.url),
);
const decWasm = readFileSync(
  new URL("../../packages/codecs/jpeg/codec/mozjpeg_dec.wasm", import.meta.url),
);

async function loadCodec(page: Page) {
  await page.evaluate(
    ([wrapper, ejs, djs, ewasm, dwasm]) => {
      const url = (content: string | Uint8Array, type: string) =>
        URL.createObjectURL(new Blob([content as BlobPart], { type }));
      (window as unknown as { __jpegAssets: Record<string, string> }).__jpegAssets = {
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
      __jpegAssets: Record<string, string>;
      __jpeg: typeof import("../../packages/codecs/jpeg/src/index.js");
    };
    const mod = (await import(
      w.__jpegAssets["wrapperUrl"]!
    )) as typeof import("../../packages/codecs/jpeg/src/index.js");
    mod.setCodecAssets({
      encodeJsUrl: w.__jpegAssets["encodeJsUrl"],
      encodeWasmUrl: w.__jpegAssets["encodeWasmUrl"],
      decodeJsUrl: w.__jpegAssets["decodeJsUrl"],
      decodeWasmUrl: w.__jpegAssets["decodeWasmUrl"],
    });
    w.__jpeg = mod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadCodec(page);
});

test("MozJPEG encode: solid red ImageData becomes a real JPEG", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __jpeg: jpeg } = window as unknown as {
      __jpeg: typeof import("../../packages/codecs/jpeg/src/index.js");
    };
    const data = new ImageData(32, 32);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 255;
      data.data[i + 3] = 255;
    }
    const out = new Uint8Array(await jpeg.encode(data, { quality: 80 }));
    // Walk JPEG markers until SOS to find the SOF marker honestly.
    let sof = -1;
    let i = 2;
    while (i < out.length - 1) {
      if (out[i] !== 0xff) break;
      const marker = out[i + 1]!;
      if (marker === 0xda) break;
      if (marker === 0xc0 || marker === 0xc2) {
        sof = marker;
        break;
      }
      const len = (out[i + 2]! << 8) + out[i + 3]!;
      i += 2 + len;
    }
    return { soi: [out[0], out[1]], size: out.length, sof };
  });
  expect(r.soi).toEqual([0xff, 0xd8]);
  expect(r.size).toBeGreaterThan(100);
  expect(r.size).toBeLessThan(20_000);
  expect(r.sof).toBe(0xc2); // progressive by default
});

test("MozJPEG roundtrip: encode -> decode returns the same picture", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __jpeg: jpeg } = window as unknown as {
      __jpeg: typeof import("../../packages/codecs/jpeg/src/index.js");
    };
    const data = new ImageData(32, 32);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 255;
      data.data[i + 3] = 255;
    }
    const encoded = await jpeg.encode(data, { quality: 90 });
    const decoded = await jpeg.decode(encoded);
    const center = (16 * 32 + 16) * 4;
    return {
      width: decoded.width,
      height: decoded.height,
      pixel: [
        decoded.data[center],
        decoded.data[center + 1],
        decoded.data[center + 2],
        decoded.data[center + 3],
      ],
    };
  });
  expect(r.width).toBe(32);
  expect(r.height).toBe(32);
  expect(r.pixel[0]).toBeGreaterThan(180);
  expect(r.pixel[1]).toBeLessThan(80);
  expect(r.pixel[2]).toBeLessThan(80);
  expect(r.pixel[3]).toBe(255);
});

test("MozJPEG decode: reads a canvas-produced baseline JPEG too", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __jpeg: jpeg } = window as unknown as {
      __jpeg: typeof import("../../packages/codecs/jpeg/src/index.js");
    };
    const canvas = new OffscreenCanvas(40, 24);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#3366ff";
    ctx.fillRect(0, 0, 40, 24);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
    const decoded = await jpeg.decode(await blob.arrayBuffer());
    return { width: decoded.width, height: decoded.height };
  });
  expect(r).toEqual({ width: 40, height: 24 });
});

test("setCodecAssets after first use rebinds to the fresh module instance", async ({ page }) => {
  // Regression: setCodecAssets clears the loader cache, so the next call
  // runs on a NEW WASM module instance. The cwrap'd functions must be
  // bound to that instance — before the fix, the stale binding silently
  // returned 0 bytes (found by the consumer test, 2026-11-09).
  const r = await page.evaluate(async () => {
    const w = window as unknown as {
      __jpegAssets: Record<string, string>;
      __jpeg: typeof import("../../packages/codecs/jpeg/src/index.js");
    };
    const data = new ImageData(24, 24);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 200;
      data.data[i + 1] = 120;
      data.data[i + 2] = 40;
      data.data[i + 3] = 255;
    }
    const first = new Uint8Array(await w.__jpeg.encode(data, { quality: 80 }));
    w.__jpeg.setCodecAssets({
      encodeJsUrl: w.__jpegAssets["encodeJsUrl"],
      encodeWasmUrl: w.__jpegAssets["encodeWasmUrl"],
      decodeJsUrl: w.__jpegAssets["decodeJsUrl"],
      decodeWasmUrl: w.__jpegAssets["decodeWasmUrl"],
    });
    const second = new Uint8Array(await w.__jpeg.encode(data, { quality: 80 }));
    const decoded = await w.__jpeg.decode(second);
    return { first: first.length, second: second.length, w: decoded.width, h: decoded.height };
  });
  expect(r.first).toBeGreaterThan(0);
  expect(r.second).toBeGreaterThan(0);
  expect(r.w).toBe(24);
  expect(r.h).toBe(24);
});
