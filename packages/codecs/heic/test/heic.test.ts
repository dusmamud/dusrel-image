import { describe, expect, it } from "vitest";
import { decodeHeic, decodeHeicWasm, init, isHeic, setCodecAssets } from "../src/index.js";

/** Builds a minimal ISO-BMFF ftyp box with the given brands. */
function ftyp(major: string, compatible: string[]): Uint8Array {
  const brands = [major, ...compatible];
  const size = 8 + 4 + 4 + brands.length * 4 - 4; // header + major + minor + compat
  const bytes = new Uint8Array(8 + 4 + 4 * brands.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, size);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4); // "ftyp"
  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i] as string;
    for (let c = 0; c < 4; c++) bytes[8 + i * 4 + c] = brand.charCodeAt(c);
  }
  return bytes;
}

describe("isHeic", () => {
  it("accepts a heic major brand", () => {
    expect(isHeic(ftyp("heic", ["mif1"]))).toBe(true);
  });

  it("accepts a generic HEIF major brand with a heic compatible brand", () => {
    expect(isHeic(ftyp("mif1", ["mif1", "heic"]))).toBe(true);
  });

  it("accepts msf1 (multi-image) and heix brands", () => {
    expect(isHeic(ftyp("msf1", ["msf1", "heic"]))).toBe(true);
    expect(isHeic(ftyp("heix", []))).toBe(true);
  });

  it("rejects AVIF, video and other formats", () => {
    expect(isHeic(ftyp("avif", ["avif", "mif1"]))).toBe(false);
    expect(isHeic(ftyp("mp42", ["mp42", "isom"]))).toBe(false);
    expect(isHeic(ftyp("isom", ["isom"]))).toBe(false);
  });

  it("rejects non-ftyp and truncated inputs", () => {
    expect(isHeic(new Uint8Array(0))).toBe(false);
    expect(isHeic(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(false);
    expect(isHeic(ftyp("heic", []).subarray(0, 6))).toBe(false);
  });
});

describe("decodeHeic input handling", () => {
  it("rejects a non-HEIC buffer before touching any decoder", async () => {
    await expect(decodeHeic(new Uint8Array([1, 2, 3, 4]))).rejects.toBeInstanceOf(RangeError);
  });

  it("rejects empty WASM input", async () => {
    await expect(decodeHeicWasm(new Uint8Array(0))).rejects.toBeInstanceOf(RangeError);
  });
});

describe("public surface", () => {
  it("exports the documented functions", () => {
    for (const fn of [decodeHeic, decodeHeicWasm, isHeic, init, setCodecAssets]) {
      expect(typeof fn).toBe("function");
    }
  });
});
