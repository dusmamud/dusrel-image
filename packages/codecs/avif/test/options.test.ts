import { describe, expect, it } from "vitest";
import { resolveEncodeOptions } from "../src/encode.js";
import * as pkg from "../src/index.js";

describe("resolveEncodeOptions", () => {
  it("applies the documented defaults (speed 9, qualityAlpha follows quality)", () => {
    expect(resolveEncodeOptions()).toEqual({
      quality: 50,
      qualityAlpha: 50,
      speed: 9,
      pixelFormat: "420",
    });
    expect(resolveEncodeOptions({ quality: 70 }).qualityAlpha).toBe(70);
  });

  it("rejects invalid values", () => {
    expect(() => resolveEncodeOptions({ quality: 101 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ quality: 33.3 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ speed: 11 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ qualityAlpha: -1 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ pixelFormat: "400" as "420" })).toThrow(RangeError);
  });
});

describe("public surface", () => {
  it("exports the documented entry points", () => {
    expect(typeof pkg.encode).toBe("function");
    expect(typeof pkg.decode).toBe("function");
    expect(typeof pkg.initEncode).toBe("function");
    expect(typeof pkg.initDecode).toBe("function");
    expect(typeof pkg.setCodecAssets).toBe("function");
    expect(typeof pkg.resolveEncodeOptions).toBe("function");
  });
});
