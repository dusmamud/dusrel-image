import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-png: the Rust png crate's WASM
// artifacts committed in packages/codecs/png/codec (built by the
// wasm-build workflow from native/rust) encode and decode actual
// pixels. PNG is lossless, so the roundtrip bar is pixel-exact.
const wrapperBundle = readFileSync(
  new URL("../../packages/codecs/png/dist/index.js", import.meta.url),
  "utf8",
);
const encJs = readFileSync(
  new URL("../../packages/codecs/png/codec/png_enc.js", import.meta.url),
  "utf8",
);
const decJs = readFileSync(
  new URL("../../packages/codecs/png/codec/png_dec.js", import.meta.url),
  "utf8",
);
const encWasm = readFileSync(
  new URL("../../packages/codecs/png/codec/png_enc.wasm", import.meta.url),
);
const decWasm = readFileSync(
  new URL("../../packages/codecs/png/codec/png_dec.wasm", import.meta.url),
);

async function loadCodec(page: Page) {
  await page.evaluate(
    ([wrapper, ejs, djs, ewasm, dwasm]) => {
      const url = (content: string | Uint8Array, type: string) =>
        URL.createObjectURL(new Blob([content as BlobPart], { type }));
      (window as unknown as { __pngAssets: Record<string, string> }).__pngAssets = {
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
      __pngAssets: Record<string, string>;
      __png: typeof import("../../packages/codecs/png/src/index.js");
    };
    const mod = (await import(
      w.__pngAssets["wrapperUrl"]!
    )) as typeof import("../../packages/codecs/png/src/index.js");
    mod.setCodecAssets({
      encodeJsUrl: w.__pngAssets["encodeJsUrl"],
      encodeWasmUrl: w.__pngAssets["encodeWasmUrl"],
      decodeJsUrl: w.__pngAssets["decodeJsUrl"],
      decodeWasmUrl: w.__pngAssets["decodeWasmUrl"],
    });
    w.__png = mod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadCodec(page);
});

test("png encode: PNG signature and the browser itself can read it", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __png: png } = window as unknown as {
      __png: typeof import("../../packages/codecs/png/src/index.js");
    };
    const data = new ImageData(48, 32);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 30;
      data.data[i + 1] = 200;
      data.data[i + 2] = 90;
      data.data[i + 3] = 255;
    }
    const out = new Uint8Array(await png.encode(data));
    const sigOk = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => out[i] === b);
    const bitmap = await createImageBitmap(new Blob([out as BlobPart], { type: "image/png" }));
    return { sigOk, size: out.length, bitmapWidth: bitmap.width, bitmapHeight: bitmap.height };
  });
  expect(r.sigOk).toBe(true);
  expect(r.size).toBeGreaterThan(50);
  expect(r.bitmapWidth).toBe(48);
  expect(r.bitmapHeight).toBe(32);
});

test("png roundtrip is pixel-exact (lossless means lossless)", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __png: png } = window as unknown as {
      __png: typeof import("../../packages/codecs/png/src/index.js");
    };
    const data = new ImageData(16, 16);
    for (let p = 0; p < 16 * 16; p++) {
      data.data[p * 4] = (p * 37) % 256;
      data.data[p * 4 + 1] = (p * 91) % 256;
      data.data[p * 4 + 2] = (p * 53) % 256;
      data.data[p * 4 + 3] = (p * 149) % 256;
    }
    const encoded = await png.encode(data, { compression: "best", filter: "paeth" });
    const decoded = await png.decode(encoded);
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

test("png decode: reads a PNG written by the browser's own canvas", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __png: png } = window as unknown as {
      __png: typeof import("../../packages/codecs/png/src/index.js");
    };
    const canvas = new OffscreenCanvas(10, 6);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgb(12, 34, 56)";
    ctx.fillRect(0, 0, 10, 6);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const decoded = await png.decode(await blob.arrayBuffer());
    const px = [decoded.data[0], decoded.data[1], decoded.data[2], decoded.data[3]];
    return { width: decoded.width, height: decoded.height, px };
  });
  expect(r.width).toBe(10);
  expect(r.height).toBe(6);
  expect(r.px).toEqual([12, 34, 56, 255]);
});
