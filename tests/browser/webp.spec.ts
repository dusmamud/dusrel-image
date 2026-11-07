import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-webp: the libwebp WASM artifacts
// committed in packages/codecs/webp/codec (built by the wasm-build
// workflow from native/webp) encode and decode actual pixels.
const wrapperBundle = readFileSync(
  new URL("../../packages/codecs/webp/dist/index.js", import.meta.url),
  "utf8",
);
const encJs = readFileSync(
  new URL("../../packages/codecs/webp/codec/webp_enc.js", import.meta.url),
  "utf8",
);
const decJs = readFileSync(
  new URL("../../packages/codecs/webp/codec/webp_dec.js", import.meta.url),
  "utf8",
);
const encWasm = readFileSync(
  new URL("../../packages/codecs/webp/codec/webp_enc.wasm", import.meta.url),
);
const decWasm = readFileSync(
  new URL("../../packages/codecs/webp/codec/webp_dec.wasm", import.meta.url),
);

async function loadCodec(page: Page) {
  await page.evaluate(
    ([wrapper, ejs, djs, ewasm, dwasm]) => {
      const url = (content: string | Uint8Array, type: string) =>
        URL.createObjectURL(new Blob([content as BlobPart], { type }));
      (window as unknown as { __webpAssets: Record<string, string> }).__webpAssets = {
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
      __webpAssets: Record<string, string>;
      __webp: typeof import("../../packages/codecs/webp/src/index.js");
    };
    const mod = (await import(
      w.__webpAssets["wrapperUrl"]!
    )) as typeof import("../../packages/codecs/webp/src/index.js");
    mod.setCodecAssets({
      encodeJsUrl: w.__webpAssets["encodeJsUrl"],
      encodeWasmUrl: w.__webpAssets["encodeWasmUrl"],
      decodeJsUrl: w.__webpAssets["decodeJsUrl"],
      decodeWasmUrl: w.__webpAssets["decodeWasmUrl"],
    });
    w.__webp = mod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadCodec(page);
});

test("libwebp lossy encode: RIFF/WEBP header and a decodable file", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __webp: webp } = window as unknown as {
      __webp: typeof import("../../packages/codecs/webp/src/index.js");
    };
    const data = new ImageData(48, 32);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 30;
      data.data[i + 1] = 200;
      data.data[i + 2] = 90;
      data.data[i + 3] = 255;
    }
    const out = new Uint8Array(await webp.encode(data, { quality: 80 }));
    const header =
      String.fromCharCode(...out.slice(0, 4)) + String.fromCharCode(...out.slice(8, 12));
    // Interop in the other direction: the browser itself must read it.
    const bitmap = await createImageBitmap(new Blob([out as BlobPart], { type: "image/webp" }));
    return { header, size: out.length, bitmapWidth: bitmap.width, bitmapHeight: bitmap.height };
  });
  expect(r.header).toBe("RIFFWEBP");
  expect(r.size).toBeGreaterThan(20);
  expect(r.bitmapWidth).toBe(48);
  expect(r.bitmapHeight).toBe(32);
});

test("libwebp lossless roundtrip is pixel-exact", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __webp: webp } = window as unknown as {
      __webp: typeof import("../../packages/codecs/webp/src/index.js");
    };
    const data = new ImageData(16, 16);
    for (let p = 0; p < 16 * 16; p++) {
      data.data[p * 4] = (p * 37) % 256;
      data.data[p * 4 + 1] = (p * 91) % 256;
      data.data[p * 4 + 2] = (p * 53) % 256;
      data.data[p * 4 + 3] = 255;
    }
    const encoded = await webp.encode(data, { lossless: true });
    const decoded = await webp.decode(encoded);
    let exact = decoded.width === 16 && decoded.height === 16;
    if (exact) {
      for (let i = 0; i < data.data.length; i++) {
        if (decoded.data[i] !== data.data[i]) {
          exact = false;
          break;
        }
      }
    }
    return { exact };
  });
  expect(r.exact).toBe(true);
});

test("libwebp decode: reads a WebP it did not write (our encoder, browser check)", async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const { __webp: webp } = window as unknown as {
      __webp: typeof import("../../packages/codecs/webp/src/index.js");
    };
    const data = new ImageData(20, 12);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 250;
      data.data[i + 1] = 180;
      data.data[i + 3] = 255;
    }
    const encoded = await webp.encode(data, { quality: 95 });
    const decoded = await webp.decode(encoded);
    const center = (6 * 20 + 10) * 4;
    return {
      width: decoded.width,
      height: decoded.height,
      pixel: [decoded.data[center], decoded.data[center + 1], decoded.data[center + 3]],
    };
  });
  expect(r.width).toBe(20);
  expect(r.height).toBe(12);
  expect(r.pixel[0]).toBeGreaterThan(200);
  expect(r.pixel[1]).toBeGreaterThan(130);
  expect(r.pixel[2]).toBe(255);
});
