import { describe, expect, it } from "vitest";
import { resolveEncodeOptions } from "../src/encode.js";
import * as pkg from "../src/index.js";

describe("resolveEncodeOptions", () => {
  it("applies the documented defaults", () => {
    expect(resolveEncodeOptions()).toEqual({ quality: 85, lossless: false, effort: 7 });
  });

  it("rejects invalid values", () => {
    expect(() => resolveEncodeOptions({ quality: 101 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ quality: -1 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ effort: 0 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ effort: 11 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ effort: 2.5 })).toThrow(RangeError);
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
