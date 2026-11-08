import { describe, expect, it } from "vitest";
import { delayToCentiseconds, resolveEncodeOptions } from "../src/encode.js";
import * as pkg from "../src/index.js";

describe("resolveEncodeOptions", () => {
  it("applies the documented defaults", () => {
    expect(resolveEncodeOptions()).toEqual({ repeat: 0, speed: 10, palette: "per-frame" });
  });

  it("rejects invalid values", () => {
    expect(() => resolveEncodeOptions({ repeat: -2 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ repeat: 1.5 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ speed: 0 })).toThrow(RangeError);
    expect(() => resolveEncodeOptions({ speed: 31 })).toThrow(RangeError);
  });
});

describe("delayToCentiseconds", () => {
  it("rounds to the GIF format's 10 ms unit and clamps", () => {
    expect(delayToCentiseconds(100)).toBe(10);
    expect(delayToCentiseconds(95)).toBe(10);
    expect(delayToCentiseconds(94)).toBe(9);
    expect(delayToCentiseconds(60_000 * 20)).toBe(65535);
    expect(() => delayToCentiseconds(-1)).toThrow(RangeError);
  });
});

describe("public surface", () => {
  it("exports the documented entry points", () => {
    expect(typeof pkg.encode).toBe("function");
    expect(typeof pkg.decode).toBe("function");
    expect(typeof pkg.optimize).toBe("function");
    expect(typeof pkg.init).toBe("function");
    expect(typeof pkg.setCodecAssets).toBe("function");
    expect(typeof pkg.resolveEncodeOptions).toBe("function");
  });
});
