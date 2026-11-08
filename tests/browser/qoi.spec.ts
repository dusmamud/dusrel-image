import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-qoi: the Rust qoi crate's
// WASM artifacts committed in packages/codecs/qoi/codec (built by
// the wasm-build workflow from native/rust) encode and decode
// actual pixels. QOI is lossless, so the roundtrip bar is
// pixel-exact; a hand-built RGB QOI proves the decoder's
// RGB -> RGBA expansion in real engines too.
const wrapperBundle = readFileSync(
  new URL("../../packages/codecs/qoi/dist/index.js", import.meta.url),
  "utf8",
);
const encJs = readFileSync(
  new URL("../../packages/codecs/qoi/codec/qoi_enc.js", import.meta.url),
  "utf8",
);
const decJs = readFileSync(
  new URL("../../packages/codecs/qoi/codec/qoi_dec.js", import.meta.url),
  "utf8",
);
const encWasm = readFileSync(
  new URL("../../packages/codecs/qoi/codec/qoi_enc.wasm", import.meta.url),
);
const decWasm = readFileSync(
  new URL("../../packages/codecs/qoi/codec/qoi_dec.wasm", import.meta.url),
);

async function loadCodec(page: Page) {
  await page.evaluate(
    ([wrapper, ejs, djs, ewasm, dwasm]) => {
      const url = (content: string | Uint8Array, type: string) =>
        URL.createObjectURL(new Blob([content as BlobPart], { type }));
      (window as unknown as { __qoiAssets: Record<string, string> }).__qoiAssets = {
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
      __qoiAssets: Record<string, string>;
      __qoi: typeof import("../../packages/codecs/qoi/src/index.js");
    };
    const mod = (await import(
      w.__qoiAssets["wrapperUrl"]!
    )) as typeof import("../../packages/codecs/qoi/src/index.js");
    mod.setCodecAssets({
      encodeJsUrl: w.__qoiAssets["encodeJsUrl"],
      encodeWasmUrl: w.__qoiAssets["encodeWasmUrl"],
      decodeJsUrl: w.__qoiAssets["decodeJsUrl"],
      decodeWasmUrl: w.__qoiAssets["decodeWasmUrl"],
    });
    w.__qoi = mod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadCodec(page);
});

test("qoi encode: 'qoif' magic, RGBA header, plausible size", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __qoi: qoi } = window as unknown as {
      __qoi: typeof import("../../packages/codecs/qoi/src/index.js");
    };
    const data = new ImageData(48, 32);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 30;
      data.data[i + 1] = 200;
      data.data[i + 2] = 90;
      data.data[i + 3] = 255;
    }
    const out = await qoi.encode(data);
    return {
      magic: String.fromCharCode(...out.slice(0, 4)),
      channels: out[12],
      colorspace: out[13],
      size: out.length,
    };
  });
  expect(r.magic).toBe("qoif");
  expect(r.channels).toBe(4);
  expect(r.colorspace).toBe(0); // sRGB tag
  expect(r.size).toBeGreaterThan(22); // header + chunks + end padding
  expect(r.size).toBeLessThan(48 * 32 * 4); // flat colour compresses hard
});

test("qoi roundtrip is pixel-exact (lossless means lossless)", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __qoi: qoi } = window as unknown as {
      __qoi: typeof import("../../packages/codecs/qoi/src/index.js");
    };
    const data = new ImageData(16, 16);
    for (let p = 0; p < 16 * 16; p++) {
      data.data[p * 4] = (p * 37) % 256;
      data.data[p * 4 + 1] = (p * 91) % 256;
      data.data[p * 4 + 2] = (p * 53) % 256;
      data.data[p * 4 + 3] = (p * 29) % 256; // varying alpha
    }
    const encoded = await qoi.encode(data);
    const decoded = await qoi.decode(encoded);
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

test("qoi decode: hand-built RGB file expands to RGBA", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __qoi: qoi } = window as unknown as {
      __qoi: typeof import("../../packages/codecs/qoi/src/index.js");
    };
    // 2x1 RGB QOI, built by hand from the spec: header (channels
    // byte 3), two QOI_OP_RGB chunks (255,0,0) and (0,255,0),
    // then the 8-byte end padding.
    const rgb = new Uint8Array([
      0x71, 0x6f, 0x69, 0x66, 0, 0, 0, 2, 0, 0, 0, 1, 3, 0, 0xfe, 255, 0, 0, 0xfe, 0, 255, 0, 0, 0,
      0, 0, 0, 0, 0, 1,
    ]);
    const decoded = await qoi.decode(rgb);
    return {
      width: decoded.width,
      height: decoded.height,
      pixels: Array.from(decoded.data),
    };
  });
  expect(r.width).toBe(2);
  expect(r.height).toBe(1);
  expect(r.pixels).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
});
