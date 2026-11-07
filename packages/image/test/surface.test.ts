import { describe, expect, it } from "vitest";
// Guards the package's public surface: everything the README promises
// must actually be exported from the entry point. (A formatting pass
// once silently dropped the batch exports; this test exists so that
// class of mistake fails loudly in unit tests, not on CI browsers.)
import * as pkg from "../src/index.js";

describe("public surface", () => {
  it("exports the documented entry points", () => {
    expect(typeof pkg.processImage).toBe("function");
    expect(typeof pkg.pipeline).toBe("function");
    expect(typeof pkg.PipelineBuilder).toBe("function");
    expect(typeof pkg.buildSegments).toBe("function");
    expect(typeof pkg.processBatch).toBe("function");
    expect(typeof pkg.runPool).toBe("function");
    expect(typeof pkg.downgradeChain).toBe("function");
    expect(typeof pkg.DusrelImageError).toBe("function");
    expect(typeof pkg.isDusrelImageError).toBe("function");
  });
});
