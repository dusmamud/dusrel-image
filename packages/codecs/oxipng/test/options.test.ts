import { describe, expect, it } from "vitest";
import { resolveOptions } from "../src/optimize.js";
import * as pkg from "../src/index.js";

describe("resolveOptions", () => {
  it("applies the documented defaults", () => {
    expect(resolveOptions()).toEqual({
      level: 2,
      strip: "safe",
      interlace: "keep",
      force: false,
    });
  });

  it("rejects invalid values", () => {
    expect(() => resolveOptions({ level: 7 })).toThrow(RangeError);
    expect(() => resolveOptions({ level: 1.5 })).toThrow(RangeError);
    expect(() => resolveOptions({ strip: "everything" as "safe" })).toThrow(RangeError);
    expect(() => resolveOptions({ interlace: "auto" as "keep" })).toThrow(RangeError);
  });
});

describe("public surface", () => {
  it("exports the documented entry points", () => {
    expect(typeof pkg.optimize).toBe("function");
    expect(typeof pkg.init).toBe("function");
    expect(typeof pkg.setCodecAssets).toBe("function");
    expect(typeof pkg.resolveOptions).toBe("function");
  });
});
