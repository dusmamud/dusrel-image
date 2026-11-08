import { describe, expect, it } from "vitest";
import * as pkg from "../src/index.js";

// Node has no ImageData global; the encode length guard runs
// before any WASM load, so a structural stub exercises it.
class ImageDataStub {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}
(globalThis as { ImageData?: unknown }).ImageData = ImageDataStub;

describe("encode input validation", () => {
  it("rejects an ImageData whose buffer does not match its dimensions", async () => {
    const bad = new ImageDataStub(new Uint8ClampedArray(3), 2, 2);
    await expect(pkg.encode(bad as ImageData)).rejects.toThrow(RangeError);
  });
});

describe("public surface", () => {
  it("exports the documented entry points", () => {
    expect(typeof pkg.encode).toBe("function");
    expect(typeof pkg.decode).toBe("function");
    expect(typeof pkg.initEncode).toBe("function");
    expect(typeof pkg.initDecode).toBe("function");
    expect(typeof pkg.setCodecAssets).toBe("function");
  });
});
