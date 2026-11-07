import { describe, expect, it } from "vitest";
import { resolveEncodeOptions } from "../src/encode.js";
import * as pkg from "../src/index.js";

describe("resolveEncodeOptions", () => {
  it("applies the documented defaults", () => {
    expect(resolveEncodeOptions()).toEqual({ quality: 75, progressive: true, chromaSubsample: 2 });
  });

  it("keeps explicit values", () => {
    expect(resolveEncodeOptions({ quality: 40, progressive: false, chromaSubsample: 0 })).toEqual({
      quality: 40,
      progressive: false,
      chromaSubsample: 0,
    });
  });

  it("rejects out-of-range quality", () => {
    expect(() => resolveEncodeOptions({ quality: 0 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ quality: 101 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ quality: 55.5 })).toThrow(RangeError);
  });

  it("rejects an unknown subsample mode", () => {
    expect(() => resolveEncodeOptions({ chromaSubsample: 3 as 0 })).toThrow(RangeError);
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
