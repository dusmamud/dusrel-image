import { describe, expect, it } from "vitest";
import * as pkg from "../src/index.js";

describe("public surface", () => {
  it("exports the documented entry points", () => {
    expect(typeof pkg.processImage).toBe("function");
    expect(typeof pkg.decodeImage).toBe("function");
    expect(typeof pkg.installWorkerHandler).toBe("function");
    expect(typeof pkg.findQualityForTargetSize).toBe("function");
    expect(typeof pkg.planTransform).toBe("function");
    expect(typeof pkg.DusrelImageError).toBe("function");
    expect(typeof pkg.isDusrelImageError).toBe("function");
  });
});
