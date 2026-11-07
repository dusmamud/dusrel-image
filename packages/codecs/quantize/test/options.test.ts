import { describe, expect, it } from "vitest";

// The unit-test runtime (Node) has no ImageData; browsers do. A
// minimal stand-in lets the pure expansion logic be tested here —
// the browser suite exercises the real class.
if (typeof globalThis.ImageData === "undefined") {
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
}
import { resolveOptions, resultToImageData } from "../src/quantize.js";
import * as pkg from "../src/index.js";

describe("resolveOptions", () => {
  it("applies the documented defaults", () => {
    expect(resolveOptions()).toEqual({ maxColors: 256, dithering: 1 });
  });

  it("rejects invalid values", () => {
    expect(() => resolveOptions({ maxColors: 1 })).toThrow(RangeError);
    expect(() => resolveOptions({ maxColors: 257 })).toThrow(RangeError);
    expect(() => resolveOptions({ maxColors: 12.5 })).toThrow(RangeError);
    expect(() => resolveOptions({ dithering: -0.1 })).toThrow(RangeError);
    expect(() => resolveOptions({ dithering: 1.5 })).toThrow(RangeError);
  });
});

describe("resultToImageData", () => {
  it("expands palette indices into RGBA pixels", () => {
    const image = resultToImageData({
      palette: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]),
      indices: new Uint8Array([0, 1, 1, 0]),
      colorCount: 2,
      width: 2,
      height: 2,
      error: 0,
    });
    expect(Array.from(image.data)).toEqual([
      255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255, 255, 0, 0, 255,
    ]);
  });
});

describe("public surface", () => {
  it("exports the documented entry points", () => {
    expect(typeof pkg.quantize).toBe("function");
    expect(typeof pkg.quantizeToImageData).toBe("function");
    expect(typeof pkg.resultToImageData).toBe("function");
    expect(typeof pkg.init).toBe("function");
    expect(typeof pkg.setCodecAssets).toBe("function");
    expect(typeof pkg.resolveOptions).toBe("function");
  });
});
