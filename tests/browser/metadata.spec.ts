import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-metadata: a minimal EXIF
// APP1 (Make + GPS) is spliced into a real canvas-encoded JPEG
// inside the page; the package must parse it, and both strip
// modes must leave a file the browser can still decode.
const metadataBundle = readFileSync(
  new URL("../../packages/features/metadata/dist/index.js", import.meta.url),
  "utf8",
);

type MetadataMod = typeof import("../../packages/features/metadata/src/index.js");

async function load(page: Page) {
  const url = await page.evaluate((content) => {
    const u = URL.createObjectURL(new Blob([content], { type: "text/javascript" }));
    (window as unknown as { __mUrl: string }).__mUrl = u;
    return u;
  }, metadataBundle);
  await page.evaluate(async () => {
    const w = window as unknown as { __mUrl: string; __m: MetadataMod };
    w.__m = (await import(w.__mUrl)) as MetadataMod;
  });
  return url;
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await load(page);
});

test("EXIF splice -> read GPS -> strip keeps a decodable JPEG", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { __m: m } = window as unknown as { __m: MetadataMod };
    // A real JPEG from the platform encoder.
    const canvas = new OffscreenCanvas(8, 8);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgb(0, 128, 255)";
    ctx.fillRect(0, 0, 8, 8);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
    const jpeg = new Uint8Array(await blob.arrayBuffer());

    // Minimal little-endian TIFF: IFD0 { Make("TestCam"), GPS ptr },
    // GPS IFD { latRef N, lat 28.6, lonRef E, lon 77.2 }.
    const tiff = new Uint8Array(150);
    const dv = new DataView(tiff.buffer);
    tiff[0] = 0x49;
    tiff[1] = 0x49;
    dv.setUint16(2, 42, true);
    dv.setUint32(4, 8, true);
    const entry = (
      base: number,
      i: number,
      tag: number,
      type: number,
      count: number,
      v: number,
    ) => {
      const at = base + 2 + i * 12;
      dv.setUint16(at, tag, true);
      dv.setUint16(at + 2, type, true);
      dv.setUint32(at + 4, count, true);
      dv.setUint32(at + 8, v, true);
    };
    dv.setUint16(8, 2, true);
    entry(8, 0, 0x010f, 2, 8, 34);
    tiff.set(new TextEncoder().encode("TestCam\0"), 34);
    entry(8, 1, 0x8825, 4, 1, 42);
    dv.setUint32(8 + 2 + 24, 0, true);
    dv.setUint16(42, 4, true);
    entry(42, 0, 0x0001, 2, 2, 0);
    tiff.set(new TextEncoder().encode("N\0"), 42 + 2 + 8);
    entry(42, 1, 0x0002, 5, 3, 102);
    entry(42, 2, 0x0003, 2, 2, 0);
    tiff.set(new TextEncoder().encode("E\0"), 42 + 2 + 24 + 8);
    entry(42, 3, 0x0004, 5, 3, 126);
    dv.setUint32(42 + 2 + 48, 0, true);
    const rat = (off: number, n: number, d: number) => {
      dv.setUint32(off, n, true);
      dv.setUint32(off + 4, d, true);
    };
    rat(102, 28, 1);
    rat(110, 36, 1);
    rat(118, 0, 1);
    rat(126, 77, 1);
    rat(134, 12, 1);
    rat(142, 0, 1);

    // Splice APP1 after the SOI.
    const app1 = new Uint8Array(4 + 6 + tiff.length);
    app1[0] = 0xff;
    app1[1] = 0xe1;
    app1[2] = (6 + tiff.length + 2) >> 8;
    app1[3] = (6 + tiff.length + 2) & 0xff;
    app1.set(new TextEncoder().encode("Exif\0\0"), 4);
    app1.set(tiff, 10);
    const spliced = new Uint8Array(jpeg.length + app1.length);
    spliced.set(jpeg.subarray(0, 2), 0);
    spliced.set(app1, 2);
    spliced.set(jpeg.subarray(2), 2 + app1.length);

    const before = m.readMetadata(spliced);
    const strippedAll = m.stripMetadata(spliced);
    const gpsOnly = m.stripMetadata(spliced, { mode: "gps-only" });
    const afterAll = m.readMetadata(strippedAll);
    const afterGps = m.readMetadata(gpsOnly);
    const decodable = async (bytes: Uint8Array) => {
      try {
        const bmp = await createImageBitmap(
          new Blob([bytes.slice().buffer as ArrayBuffer], { type: "image/jpeg" }),
        );
        bmp.close();
        return true;
      } catch {
        return false;
      }
    };
    return {
      make: before.exif?.make,
      lat: before.exif?.gps?.latitude,
      lon: before.exif?.gps?.longitude,
      allExif: afterAll.exifPresent,
      gpsMake: afterGps.exif?.make,
      gpsGone: afterGps.exif?.gps === undefined,
      decodableAll: await decodable(strippedAll),
      decodableGps: await decodable(gpsOnly),
    };
  });
  expect(r.make).toBe("TestCam");
  expect(r.lat).toBeCloseTo(28.6, 5);
  expect(r.lon).toBeCloseTo(77.2, 5);
  expect(r.allExif).toBe(false);
  expect(r.gpsMake).toBe("TestCam");
  expect(r.gpsGone).toBe(true);
  expect(r.decodableAll).toBe(true);
  expect(r.decodableGps).toBe(true);
});
