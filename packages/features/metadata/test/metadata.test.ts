import { describe, expect, it } from "vitest";
import { detectFormat, hasGps, readMetadata, stripMetadata } from "../src/index.js";

// ---------------------------------------------------------------------------
// Hand-built fixtures. The TIFF here is assembled byte by byte:
// IFD0 (Make external, Model inline, Orientation, Exif + GPS
// pointers), an Exif IFD (DateTimeOriginal), and a GPS IFD with
// rationals for 28.6 N, 77.2 W.
// ---------------------------------------------------------------------------
function buildTiff(): Uint8Array {
  const b = new Uint8Array(232);
  const dv = new DataView(b.buffer);
  const le = true;
  const enc = new TextEncoder();
  const putAscii = (off: number, s: string) => b.set(enc.encode(s), off);
  b[0] = 0x49;
  b[1] = 0x49;
  dv.setUint16(2, 42, le);
  dv.setUint32(4, 8, le);
  const entry = (base: number, i: number, tag: number, type: number, count: number, v: number) => {
    const at = base + 2 + i * 12;
    dv.setUint16(at, tag, le);
    dv.setUint16(at + 2, type, le);
    dv.setUint32(at + 4, count, le);
    dv.setUint32(at + 8, v, le);
  };
  dv.setUint16(8, 5, le);
  entry(8, 0, 0x010f, 2, 6, 74);
  putAscii(74, "Canon\0");
  entry(8, 1, 0x0110, 2, 4, 0);
  putAscii(8 + 2 + 12 + 8, "EOS\0");
  entry(8, 2, 0x0112, 3, 1, 1);
  entry(8, 3, 0x8769, 4, 1, 80);
  entry(8, 4, 0x8825, 4, 1, 118);
  dv.setUint32(8 + 2 + 60, 0, le);
  dv.setUint16(80, 1, le);
  entry(80, 0, 0x9003, 2, 20, 98);
  putAscii(98, "2024:01:02 03:04:05\0");
  dv.setUint32(80 + 2 + 12, 0, le);
  dv.setUint16(118, 5, le);
  entry(118, 0, 0x0000, 1, 4, 0x00000302);
  entry(118, 1, 0x0001, 2, 2, 0);
  putAscii(118 + 2 + 12 + 8, "N\0");
  entry(118, 2, 0x0002, 5, 3, 184);
  entry(118, 3, 0x0003, 2, 2, 0);
  putAscii(118 + 2 + 36 + 8, "W\0");
  entry(118, 4, 0x0004, 5, 3, 208);
  dv.setUint32(118 + 2 + 60, 0, le);
  const rat = (off: number, n: number, d: number) => {
    dv.setUint32(off, n, le);
    dv.setUint32(off + 4, d, le);
  };
  rat(184, 28, 1);
  rat(192, 36, 1);
  rat(200, 0, 1);
  rat(208, 77, 1);
  rat(216, 12, 1);
  rat(224, 0, 1);
  return b;
}

function buildJpeg(tiff: Uint8Array): Uint8Array {
  const parts: number[] = [0xff, 0xd8];
  const seg = (marker: number, payload: Uint8Array) => {
    parts.push(0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload);
  };
  seg(0xe0, new Uint8Array([0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]));
  const exifPayload = new Uint8Array(6 + tiff.length);
  exifPayload.set([0x45, 0x78, 0x69, 0x66, 0, 0]);
  exifPayload.set(tiff, 6);
  seg(0xe1, exifPayload);
  seg(0xe1, new TextEncoder().encode("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>"));
  seg(0xfe, new TextEncoder().encode("a comment"));
  seg(0xda, new Uint8Array(10));
  parts.push(0x11, 0x22, 0xff, 0xd9);
  return new Uint8Array(parts);
}

function pngChunk(type: string, data: Uint8Array): number[] {
  const out = [
    (data.length >>> 24) & 255,
    (data.length >>> 16) & 255,
    (data.length >>> 8) & 255,
    data.length & 255,
  ];
  for (const ch of type) out.push(ch.charCodeAt(0));
  out.push(...data, 0, 0, 0, 0);
  return out;
}
function buildPng(tiff: Uint8Array): Uint8Array {
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...pngChunk("IHDR", new Uint8Array(13)),
    ...pngChunk("eXIf", tiff),
    ...pngChunk("tEXt", new TextEncoder().encode("Author\0Dus")),
    ...pngChunk("IEND", new Uint8Array(0)),
  ]);
}

function buildWebp(tiff: Uint8Array): Uint8Array {
  const chunks: number[] = [];
  const chunk = (type: string, data: Uint8Array) => {
    for (const ch of type) chunks.push(ch.charCodeAt(0));
    chunks.push(
      data.length & 255,
      (data.length >> 8) & 255,
      (data.length >> 16) & 255,
      (data.length >> 24) & 255,
    );
    chunks.push(...data);
    if (data.length % 2) chunks.push(0);
  };
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x20 | 0x08 | 0x04;
  chunk("VP8X", vp8x);
  chunk("EXIF", tiff);
  chunk("XMP ", new TextEncoder().encode("<x:xmpmeta/>"));
  chunk("VP8 ", new Uint8Array([1, 2, 3, 4]));
  const body = [0x57, 0x45, 0x42, 0x50, ...chunks];
  const out = new Uint8Array(8 + body.length);
  out.set([0x52, 0x49, 0x46, 0x46], 0);
  new DataView(out.buffer).setUint32(4, body.length, true);
  out.set(body, 8);
  return out;
}

const tiff = buildTiff();

describe("JPEG", () => {
  const jpeg = buildJpeg(tiff);
  it("detects the format and parses EXIF fields", () => {
    expect(detectFormat(jpeg)).toBe("jpeg");
    const info = readMetadata(jpeg);
    expect(info.exifPresent).toBe(true);
    expect(info.xmpPresent).toBe(true);
    expect(info.exif?.make).toBe("Canon");
    expect(info.exif?.model).toBe("EOS");
    expect(info.exif?.orientation).toBe(1);
    expect(info.exif?.dateTimeOriginal).toBe("2024:01:02 03:04:05");
  });
  it("parses GPS rationals into signed decimal degrees", () => {
    const gps = readMetadata(jpeg).exif?.gps;
    expect(gps?.latitude).toBeCloseTo(28.6, 6);
    expect(gps?.longitude).toBeCloseTo(-77.2, 6);
    expect(hasGps(jpeg)).toBe(true);
  });
  it("strip-all removes EXIF, XMP and comments, keeps the scan", () => {
    const out = stripMetadata(jpeg);
    const info = readMetadata(out);
    expect(info.exifPresent).toBe(false);
    expect(info.xmpPresent).toBe(false);
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    expect(out[out.length - 1]).toBe(0xd9);
    expect(new TextDecoder().decode(out)).not.toContain("a comment");
    expect(out.length).toBeLessThan(jpeg.length);
  });
  it("gps-only keeps camera fields and drops coordinates", () => {
    const out = stripMetadata(jpeg, { mode: "gps-only" });
    const info = readMetadata(out);
    expect(info.exifPresent).toBe(true);
    expect(info.exif?.make).toBe("Canon");
    expect(info.exif?.dateTimeOriginal).toBe("2024:01:02 03:04:05");
    expect(info.exif?.gps).toBeUndefined();
    expect(hasGps(out)).toBe(false);
  });
});

describe("PNG", () => {
  const png = buildPng(tiff);
  it("reads eXIf and textual chunk keys", () => {
    const info = readMetadata(png);
    expect(info.format).toBe("png");
    expect(info.exifPresent).toBe(true);
    expect(info.exif?.make).toBe("Canon");
    expect(info.textKeys).toEqual(["Author"]);
    expect(info.exif?.gps?.latitude).toBeCloseTo(28.6, 6);
  });
  it("strip-all removes eXIf and tEXt, keeps structure", () => {
    const out = stripMetadata(png);
    const info = readMetadata(out);
    expect(info.exifPresent).toBe(false);
    expect(info.textKeys).toEqual([]);
    expect(out.length).toBeLessThan(png.length);
  });
  it("gps-only rebuilds eXIf without GPS (valid re-read)", () => {
    const out = stripMetadata(png, { mode: "gps-only" });
    const info = readMetadata(out);
    expect(info.exif?.make).toBe("Canon");
    expect(info.exif?.gps).toBeUndefined();
    expect(info.textKeys).toEqual(["Author"]); // textual chunks untouched in gps-only
  });
});

describe("WebP", () => {
  const webp = buildWebp(tiff);
  it("reads EXIF and XMP presence", () => {
    const info = readMetadata(webp);
    expect(info.format).toBe("webp");
    expect(info.exifPresent).toBe(true);
    expect(info.xmpPresent).toBe(true);
    expect(info.exif?.gps?.longitude).toBeCloseTo(-77.2, 6);
  });
  it("strip-all removes chunks AND clears the VP8X feature bits + fixes RIFF size", () => {
    const out = stripMetadata(webp);
    const info = readMetadata(out);
    expect(info.exifPresent).toBe(false);
    expect(info.xmpPresent).toBe(false);
    expect(out[20]! & 0x0c).toBe(0); // EXIF|XMP bits cleared
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8);
  });
  it("gps-only rebuilds the EXIF chunk without GPS", () => {
    const out = stripMetadata(webp, { mode: "gps-only" });
    const info = readMetadata(out);
    expect(info.exif?.make).toBe("Canon");
    expect(info.exif?.gps).toBeUndefined();
  });
});

describe("unknown input", () => {
  it("reports format null and strip returns an unchanged copy", () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5]);
    expect(detectFormat(junk)).toBeNull();
    expect(readMetadata(junk).exifPresent).toBe(false);
    const out = stripMetadata(junk);
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5]);
    expect(out).not.toBe(junk);
  });
  it("rejects a bogus mode", () => {
    expect(() => stripMetadata(buildJpeg(tiff), { mode: "nope" as "all" })).toThrow(RangeError);
  });
});
