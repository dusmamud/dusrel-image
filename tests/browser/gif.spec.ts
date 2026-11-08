import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-gif: the Rust `gif` crate WASM
// committed in packages/features/gif/codec (built by the wasm-build
// workflow from native/rust) encodes, decodes and optimises animated
// GIFs in all three engines.
const wrapperBundle = readFileSync(
  new URL("../../packages/features/gif/dist/index.js", import.meta.url),
  "utf8",
);
const gifJs = readFileSync(
  new URL("../../packages/features/gif/codec/gif.js", import.meta.url),
  "utf8",
);
const gifWasm = readFileSync(
  new URL("../../packages/features/gif/codec/gif.wasm", import.meta.url),
);

async function loadCodec(page: Page) {
  await page.evaluate(
    ([wrapper, js, wasm]) => {
      const url = (content: string | Uint8Array, type: string) =>
        URL.createObjectURL(new Blob([content as BlobPart], { type }));
      (window as unknown as { __gifAssets: Record<string, string> }).__gifAssets = {
        wrapperUrl: url(wrapper!, "text/javascript"),
        jsUrl: url(js!, "text/javascript"),
        wasmUrl: url(wasm!, "application/wasm"),
      };
    },
    [wrapperBundle, gifJs, new Uint8Array(gifWasm)] as const,
  );
  await page.evaluate(async () => {
    const w = window as unknown as {
      __gifAssets: Record<string, string>;
      __gif: typeof import("../../packages/features/gif/src/index.js");
    };
    const mod = (await import(
      w.__gifAssets["wrapperUrl"]!
    )) as typeof import("../../packages/features/gif/src/index.js");
    mod.setCodecAssets({ jsUrl: w.__gifAssets["jsUrl"], wasmUrl: w.__gifAssets["wasmUrl"] });
    w.__gif = mod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadCodec(page);
});

// Runs INSIDE page.evaluate: ImageData only exists in the page,
// not in the Node test process.
const SOLID_FRAMES_SNIPPET = `
  const mk = (r, g, b) => {
    const data = new ImageData(16, 16);
    for (let p = 0; p < 16 * 16; p++) {
      data.data[p * 4] = r;
      data.data[p * 4 + 1] = g;
      data.data[p * 4 + 2] = b;
      data.data[p * 4 + 3] = 255;
    }
    return data;
  };
  const frames = [
    { data: mk(255, 0, 0), delay: 100 },
    { data: mk(0, 255, 0), delay: 200 },
  ];
`;

test("gif encode: GIF89a header, browser displays it, roundtrip is exact", async ({ page }) => {
  const r = await page.evaluate(async (snippet) => {
    const frames = new Function(`${snippet}; return frames;`)() as {
      data: ImageData;
      delay: number;
    }[];
    const { __gif: gif } = window as unknown as {
      __gif: typeof import("../../packages/features/gif/src/index.js");
    };
    const out = await gif.encode(frames);
    const header = String.fromCharCode(...out.slice(0, 6));
    // The browser itself must accept the file as an image.
    const bitmap = await createImageBitmap(new Blob([out as BlobPart], { type: "image/gif" }));
    const decoded = await gif.decode(out);
    const px = (f: number, i: number) => [
      decoded.frames[f]!.data.data[i],
      decoded.frames[f]!.data.data[i + 1],
      decoded.frames[f]!.data.data[i + 2],
      decoded.frames[f]!.data.data[i + 3],
    ];
    return {
      header,
      bitmapWidth: bitmap.width,
      count: decoded.frames.length,
      repeat: decoded.repeat,
      delays: decoded.frames.map((f) => f.delay),
      first: px(0, 0),
      second: px(1, 0),
    };
  }, SOLID_FRAMES_SNIPPET);
  expect(r.header).toBe("GIF89a");
  expect(r.bitmapWidth).toBe(16);
  expect(r.count).toBe(2);
  expect(r.repeat).toBe(0);
  expect(r.delays).toEqual([100, 200]);
  expect(r.first).toEqual([255, 0, 0, 255]);
  expect(r.second).toEqual([0, 255, 0, 255]);
});

test("gif optimize: global palette re-encode stays pixel-exact and no larger", async ({ page }) => {
  const r = await page.evaluate(async (snippet) => {
    const frames = new Function(`${snippet}; return frames;`)() as {
      data: ImageData;
      delay: number;
    }[];
    const { __gif: gif } = window as unknown as {
      __gif: typeof import("../../packages/features/gif/src/index.js");
    };
    const original = await gif.encode(frames);
    const optimized = await gif.optimize(original, { palette: "global" });
    const decoded = await gif.decode(optimized);
    return {
      originalSize: original.length,
      optimizedSize: optimized.length,
      second: [
        decoded.frames[1]!.data.data[0],
        decoded.frames[1]!.data.data[1],
        decoded.frames[1]!.data.data[2],
      ],
      delays: decoded.frames.map((f) => f.delay),
    };
  }, SOLID_FRAMES_SNIPPET);
  expect(r.optimizedSize).toBeLessThanOrEqual(r.originalSize);
  expect(r.second).toEqual([0, 255, 0]);
  expect(r.delays).toEqual([100, 200]);
});

test("gif encode: mismatched frame sizes are rejected before any WASM runs", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __gif: gif } = window as unknown as {
      __gif: typeof import("../../packages/features/gif/src/index.js");
    };
    let message = "";
    try {
      await gif.encode([{ data: new ImageData(8, 8) }, { data: new ImageData(16, 16) }]);
    } catch (e) {
      message = (e as Error).message;
    }
    return message;
  });
  expect(r).toContain("all frames must match");
});
