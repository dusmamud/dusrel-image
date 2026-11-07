import { describe, expect, it } from "vitest";
import { resolveOptions } from "../src/resize.js";
import * as pkg from "../src/index.js";

describe("resolveOptions", () => {
  it("applies the documented defaults", () => {
    expect(resolveOptions({ width: 100, height: 50 })).toEqual({
      width: 100,
      height: 50,
      filter: "lanczos3",
      alpha: "premultiplied",
    });
  });

  it("rejects invalid values", () => {
    expect(() => resolveOptions({ width: 0, height: 10 })).toThrow(RangeError);
    expect(() => resolveOptions({ width: 10, height: -3 })).toThrow(RangeError);
    expect(() => resolveOptions({ width: 10.5, height: 10 })).toThrow(RangeError);
    expect(() => resolveOptions({ width: 10, height: 10, filter: "hqx" as "nearest" })).toThrow(
      RangeError,
    );
    expect(() => resolveOptions({ width: 10, height: 10, alpha: "auto" as "straight" })).toThrow(
      RangeError,
    );
  });
});

describe("public surface", () => {
  it("exports the documented entry points", () => {
    expect(typeof pkg.resize).toBe("function");
    expect(typeof pkg.init).toBe("function");
    expect(typeof pkg.setCodecAssets).toBe("function");
    expect(typeof pkg.resolveOptions).toBe("function");
  });
});
