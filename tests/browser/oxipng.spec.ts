import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-oxipng: the committed oxipng
// WASM (built by the wasm-build workflow from native/rust) shrinks a
// fat PNG losslessly. Pixel verification cross-checks with
// @dusrel/image-png's decoder — a different package, a different
// engine path — so the two implementations vouch for each other.
const oxiBundle = readFileSync(
  new URL("../../packages/codecs/oxipng/dist/index.js", import.meta.url),
  "utf8",
);
const oxiJs = readFileSync(
  new URL("../../packages/codecs/oxipng/codec/oxipng.js", import.meta.url),
  "utf8",
);
const oxiWasm = readFileSync(
  new URL("../../packages/codecs/oxipng/codec/oxipng.wasm", import.meta.url),
);
const pngBundle = readFileSync(
  new URL("../../packages/codecs/png/dist/index.js", import.meta.url),
  "utf8",
);
const pngEncJs = readFileSync(
  new URL("../../packages/codecs/png/codec/png_enc.js", import.meta.url),
  "utf8",
);
const pngEncWasm = readFileSync(
  new URL("../../packages/codecs/png/codec/png_enc.wasm", import.meta.url),
);
const pngDecJs = readFileSync(
  new URL("../../packages/codecs/png/codec/png_dec.js", import.meta.url),
  "utf8",
);
const pngDecWasm = readFileSync(
  new URL("../../packages/codecs/png/codec/png_dec.wasm", import.meta.url),
);

type PngMod = typeof import("../../packages/codecs/png/src/index.js");
type OxiMod = typeof import("../../packages/codecs/oxipng/src/index.js");

async function loadPackages(page: Page) {
  await page.evaluate(
    ([ob, oj, ow, pb, ej, ew, dj, dw]) => {
      const url = (content: string | Uint8Array, type: string) =>
        URL.createObjectURL(new Blob([content as BlobPart], { type }));
      (window as unknown as { __assets: Record<string, string> }).__assets = {
        oxiWrapper: url(ob!, "text/javascript"),
        oxiJs: url(oj!, "text/javascript"),
        oxiWasm: url(ow!, "application/wasm"),
        pngWrapper: url(pb!, "text/javascript"),
        pngEncJs: url(ej!, "text/javascript"),
        pngEncWasm: url(ew!, "application/wasm"),
        pngDecJs: url(dj!, "text/javascript"),
        pngDecWasm: url(dw!, "application/wasm"),
      };
    },
    [
      oxiBundle,
      oxiJs,
      new Uint8Array(oxiWasm),
      pngBundle,
      pngEncJs,
      new Uint8Array(pngEncWasm),
      pngDecJs,
      new Uint8Array(pngDecWasm),
    ] as const,
  );
  await page.evaluate(async () => {
    const w = window as unknown as {
      __assets: Record<string, string>;
      __oxi: OxiMod;
      __png: PngMod;
    };
    const a = w.__assets;
    const oxi = (await import(a["oxiWrapper"]!)) as OxiMod;
    oxi.setCodecAssets({ jsUrl: a["oxiJs"], wasmUrl: a["oxiWasm"] });
    const png = (await import(a["pngWrapper"]!)) as PngMod;
    png.setCodecAssets({
      encodeJsUrl: a["pngEncJs"],
      encodeWasmUrl: a["pngEncWasm"],
      decodeJsUrl: a["pngDecJs"],
      decodeWasmUrl: a["pngDecWasm"],
    });
    w.__oxi = oxi;
    w.__png = png;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadPackages(page);
});

test("oxipng shrinks a fat PNG and keeps every pixel", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const w = window as unknown as { __oxi: OxiMod; __png: PngMod };
    const data = new ImageData(64, 64);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4;
        data.data[i] = (x * 4) & 0xff;
        data.data[i + 1] = (y * 4) & 0xff;
        data.data[i + 2] = ((x + y) * 2) & 0xff;
        data.data[i + 3] = 255 - (x % 4) * 30;
      }
    }
    // Fat on purpose: fastest DEFLATE + no row filters.
    const fat = await w.__png.encode(data, { compression: "fast", filter: "none" });
    const out = await w.__oxi.optimize(fat, { level: 2, strip: "all" });
    const decoded = await w.__png.decode(out);
    let exact = decoded.width === 64 && decoded.height === 64;
    if (exact) {
      for (let i = 0; i < data.data.length; i++) {
        if (decoded.data[i] !== data.data[i]) {
          exact = false;
          break;
        }
      }
    }
    return { fatSize: fat.byteLength, outSize: out.byteLength, exact };
  });
  expect(r.exact).toBe(true);
  expect(r.outSize).toBeLessThan(r.fatSize);
});

test("oxipng strip=all removes a tEXt chunk; strip=none keeps it", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const w = window as unknown as { __oxi: OxiMod; __png: PngMod };
    const data = new ImageData(16, 16);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 200;
      data.data[i + 3] = 255;
    }
    const base = new Uint8Array(await w.__png.encode(data));
    // Inject a tEXt chunk right after IHDR (33 bytes in).
    const crcTable = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
    const crc32 = (buf: Uint8Array) => {
      let c = 0xffffffff;
      for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
    const text = new TextEncoder().encode("Author\0Dusrel Test");
    const chunk = new Uint8Array(12 + text.length);
    new DataView(chunk.buffer).setUint32(0, text.length);
    chunk.set([0x74, 0x45, 0x58, 0x74], 4); // tEXt
    chunk.set(text, 8);
    new DataView(chunk.buffer).setUint32(
      8 + text.length,
      crc32(chunk.subarray(4, 8 + text.length)),
    );
    const withText = new Uint8Array(base.length + chunk.length);
    withText.set(base.subarray(0, 33), 0);
    withText.set(chunk, 33);
    withText.set(base.subarray(33), 33 + chunk.length);
    const hasText = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes).includes("tEXt");
    const stripped = new Uint8Array(await w.__oxi.optimize(withText, { strip: "all" }));
    const kept = new Uint8Array(await w.__oxi.optimize(withText, { strip: "none", force: true }));
    return { inputHas: hasText(withText), strippedHas: hasText(stripped), keptHas: hasText(kept) };
  });
  expect(r.inputHas).toBe(true);
  expect(r.strippedHas).toBe(false);
  expect(r.keptHas).toBe(true);
});
