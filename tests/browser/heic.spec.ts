import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-heic: the libheif WASM
// artifacts committed in packages/codecs/heic/codec (built by
// the wasm-build workflow from native/heic, libheif v1.23.7 +
// libde265 1.0.15, ADR-0008) decode a real HEIC photo —
// libheif's own examples/example.heic, 1280x854 — in all three
// engines. The reference numbers were verified in Node against
// the same artifacts before they were committed. The default
// native-first path is also exercised: WebKit decodes natively,
// Chromium/Firefox fall back to WASM, and both must agree.
const wrapperBundle = readFileSync(
  new URL("../../packages/codecs/heic/dist/index.js", import.meta.url),
  "utf8",
);
const decJs = readFileSync(
  new URL("../../packages/codecs/heic/codec/heic_dec.js", import.meta.url),
  "utf8",
);
const decWasm = readFileSync(
  new URL("../../packages/codecs/heic/codec/heic_dec.wasm", import.meta.url),
);
const fixture = readFileSync(
  new URL("../../packages/codecs/heic/test/fixture.heic", import.meta.url),
);

const EXPECTED = {
  width: 1280,
  height: 854,
  mean: [123, 126, 121, 255],
  corner: [168, 177, 208, 255],
  centre: [140, 136, 92, 255],
};

async function loadCodec(page: Page) {
  await page.evaluate(
    ([wrapper, djs, dwasm, fixtureBytes]) => {
      const url = (content: string | Uint8Array, type: string) =>
        URL.createObjectURL(new Blob([content as BlobPart], { type }));
      (window as unknown as { __heicAssets: Record<string, string> }).__heicAssets = {
        wrapperUrl: url(wrapper!, "text/javascript"),
        jsUrl: url(djs!, "text/javascript"),
        wasmUrl: url(dwasm!, "application/wasm"),
      };
      (window as unknown as { __heicFixture: Uint8Array }).__heicFixture = fixtureBytes!;
    },
    [wrapperBundle, decJs, new Uint8Array(decWasm), new Uint8Array(fixture)] as const,
  );
  await page.evaluate(async () => {
    const w = window as unknown as {
      __heicAssets: Record<string, string>;
      __heic: typeof import("../../packages/codecs/heic/src/index.js");
    };
    const mod = (await import(
      w.__heicAssets["wrapperUrl"]!
    )) as typeof import("../../packages/codecs/heic/src/index.js");
    mod.setCodecAssets({ jsUrl: w.__heicAssets["jsUrl"], wasmUrl: w.__heicAssets["wasmUrl"] });
    w.__heic = mod;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await loadCodec(page);
});

test("the fixture is recognised as HEIC by its ftyp brands", async ({ page }) => {
  const result = await page.evaluate(() => {
    const w = window as unknown as {
      __heic: typeof import("../../packages/codecs/heic/src/index.js");
      __heicFixture: Uint8Array;
    };
    return {
      fixture: w.__heic.isHeic(w.__heicFixture),
      garbage: w.__heic.isHeic(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
    };
  });
  expect(result).toEqual({ fixture: true, garbage: false });
});

test("the WASM decoder decodes the fixture to the verified pixels", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const w = window as unknown as {
      __heic: typeof import("../../packages/codecs/heic/src/index.js");
      __heicFixture: Uint8Array;
    };
    const img = await w.__heic.decodeHeicWasm(w.__heicFixture);
    const mean = [0, 0, 0, 0];
    for (let i = 0; i < img.data.length; i += 4) {
      mean[0] += img.data[i] as number;
      mean[1] += img.data[i + 1] as number;
      mean[2] += img.data[i + 2] as number;
      mean[3] += img.data[i + 3] as number;
    }
    const n = img.width * img.height;
    const px = (x: number, y: number) =>
      Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
    return {
      width: img.width,
      height: img.height,
      mean: mean.map((v) => Math.round(v / n)),
      corner: px(0, 0),
      centre: px(img.width >> 1, img.height >> 1),
    };
  });
  expect(result.width).toBe(EXPECTED.width);
  expect(result.height).toBe(EXPECTED.height);
  for (let c = 0; c < 4; c++) {
    expect(Math.abs((result.mean[c] as number) - (EXPECTED.mean[c] as number))).toBeLessThanOrEqual(
      2,
    );
    expect(
      Math.abs((result.corner[c] as number) - (EXPECTED.corner[c] as number)),
    ).toBeLessThanOrEqual(4);
    expect(
      Math.abs((result.centre[c] as number) - (EXPECTED.centre[c] as number)),
    ).toBeLessThanOrEqual(4);
  }
});

test("decodeHeic (native-first default) agrees with the WASM reference", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const w = window as unknown as {
      __heic: typeof import("../../packages/codecs/heic/src/index.js");
      __heicFixture: Uint8Array;
    };
    const img = await w.__heic.decodeHeic(w.__heicFixture);
    const mean = [0, 0, 0, 0];
    for (let i = 0; i < img.data.length; i += 4) {
      mean[0] += img.data[i] as number;
      mean[1] += img.data[i + 1] as number;
      mean[2] += img.data[i + 2] as number;
      mean[3] += img.data[i + 3] as number;
    }
    const n = img.width * img.height;
    return { width: img.width, height: img.height, mean: mean.map((v) => Math.round(v / n)) };
  });
  expect(result.width).toBe(EXPECTED.width);
  expect(result.height).toBe(EXPECTED.height);
  // A native decoder (WebKit) may upsample chroma slightly
  // differently from libde265 — allow a wider mean tolerance.
  for (let c = 0; c < 4; c++) {
    expect(Math.abs((result.mean[c] as number) - (EXPECTED.mean[c] as number))).toBeLessThanOrEqual(
      6,
    );
  }
});

test("non-HEIC input is rejected before any decoder runs", async ({ page }) => {
  const message = await page.evaluate(async () => {
    const w = window as unknown as {
      __heic: typeof import("../../packages/codecs/heic/src/index.js");
    };
    try {
      await w.__heic.decodeHeic(new Uint8Array([1, 2, 3, 4]));
      return "no error";
    } catch (err) {
      return `${(err as Error).constructor.name}: ${(err as Error).message}`;
    }
  });
  expect(message).toContain("RangeError");
});
