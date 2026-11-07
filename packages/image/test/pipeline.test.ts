import { describe, expect, it } from "vitest";
import { buildSegments, type PipelineOp } from "../src/pipeline.js";
import { downgradeChain } from "../src/fallback.js";
import { buildReport } from "../src/report.js";
import type { ImagePlugin } from "../src/types.js";

const plugin: ImagePlugin = { name: "noop", apply: async (b) => b };

describe("downgradeChain", () => {
  it("walks webp -> jpeg -> png", () => {
    expect(downgradeChain("image/webp")).toEqual(["image/jpeg", "image/png"]);
    expect(downgradeChain("image/jpeg")).toEqual(["image/png"]);
    expect(downgradeChain("image/png")).toEqual([]);
  });
});

describe("buildSegments", () => {
  it("merges consecutive canvas ops into one segment", () => {
    const ops: PipelineOp[] = [
      { type: "crop", rect: { x: 0, y: 0, width: 100, height: 100 } },
      { type: "rotate", degrees: 90 },
      { type: "rotate", degrees: 90 },
      { type: "resize", options: { width: 50 } },
      { type: "format", format: "image/webp", quality: 0.7 },
    ];
    const segments = buildSegments(ops);
    expect(segments).toHaveLength(1);
    const [only] = segments;
    expect(only?.type).toBe("canvas");
    if (only?.type === "canvas") {
      expect(only.options.rotate).toBe(180);
      expect(only.options.format).toBe("image/webp");
      expect(only.options.quality).toBe(0.7);
      expect(only.options.crop).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    }
  });

  it("a plugin splits execution into segments, order preserved", () => {
    const ops: PipelineOp[] = [
      { type: "resize", options: { width: 200 } },
      { type: "plugin", plugin },
      { type: "format", format: "image/jpeg" },
    ];
    const segments = buildSegments(ops);
    expect(segments.map((s) => s.type)).toEqual(["canvas", "plugin", "canvas"]);
  });

  it("double flip cancels out", () => {
    const segments = buildSegments([
      { type: "flip", horizontal: true },
      { type: "flip", horizontal: true },
    ]);
    const [only] = segments;
    if (only?.type === "canvas") expect(only.options.flipHorizontal).toBe(false);
  });

  it("empty op list yields no segments (run() adds a default pass)", () => {
    expect(buildSegments([])).toEqual([]);
  });
});

describe("buildReport", () => {
  it("computes savings and carries fields through", () => {
    const report = buildReport(
      {
        blob: new Blob([]),
        format: "image/webp",
        width: 100,
        height: 50,
        sizeBytes: 250,
        originalSizeBytes: 1000,
        qualityUsed: 0.8,
        steps: ["resize"],
      },
      12.4,
      [],
    );
    expect(report.savingsRatio).toBe(0.75);
    expect(report.durationMs).toBe(12);
    expect(report.engine).toBe("canvas");
    expect(report.finalBytes).toBe(250);
  });

  it("omits savings when the original size is unknown", () => {
    const report = buildReport(
      {
        blob: new Blob([]),
        format: "image/png",
        width: 10,
        height: 10,
        sizeBytes: 90,
        qualityUsed: 1,
        steps: [],
      },
      3,
      ["return-original"],
    );
    expect(report.savingsRatio).toBeUndefined();
    expect(report.originalBytes).toBeUndefined();
    expect(report.fallbacks).toEqual(["return-original"]);
  });
});
