import { describe, expect, it } from "vitest";
import {
  applyWatermark,
  placementsFor,
  resolveWatermarkOptions,
  type PixelData,
} from "../src/index.js";

const solid = (w: number, h: number, r: number, g: number, b: number, a = 255): PixelData => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return { data, width: w, height: h };
};
const px = (p: PixelData, x: number, y: number) =>
  Array.from(p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 4));

describe("resolveWatermarkOptions", () => {
  it("applies documented defaults", () => {
    const o = resolveWatermarkOptions();
    expect(o.position).toBe("bottom-right");
    expect(o.opacity).toBe(0.7);
    expect(o.scale).toBe(0.2);
    expect(o.margin).toBe(16);
  });
  it("validates ranges", () => {
    expect(() => resolveWatermarkOptions({ opacity: 1.5 })).toThrow(RangeError);
    expect(() => resolveWatermarkOptions({ scale: 0 })).toThrow(RangeError);
    expect(() => resolveWatermarkOptions({ position: "middle" as "center" })).toThrow(RangeError);
  });
});

describe("placementsFor", () => {
  const opts = resolveWatermarkOptions({ scale: 0.25, margin: 10 });
  it("bottom-right anchors inside the margin", () => {
    // image 200x100, mark aspect 2 -> mark 50x25
    expect(placementsFor(200, 100, 2, opts)).toEqual([{ x: 140, y: 65, width: 50, height: 25 }]);
  });
  it("center centres", () => {
    const c = resolveWatermarkOptions({ position: "center", scale: 0.25, margin: 10 });
    expect(placementsFor(200, 100, 2, c)).toEqual([{ x: 75, y: 38, width: 50, height: 25 }]);
  });
  it("tile fills a grid", () => {
    const t = resolveWatermarkOptions({ position: "tile", scale: 0.25, margin: 0, tileGap: 10 });
    const placements = placementsFor(200, 100, 2, t);
    // columns at x = 0, 60, 120 (next 180+50 > 200); rows at y = 0, 35, 70 (next 105 > 100)
    expect(placements.length).toBe(9);
    expect(placements[0]).toEqual({ x: 0, y: 0, width: 50, height: 25 });
  });
});

describe("applyWatermark compositing", () => {
  it("blends with source-over at the requested opacity", () => {
    const base = solid(10, 10, 100, 100, 100);
    const mark = solid(4, 4, 255, 0, 0);
    const out = applyWatermark(base, mark, {
      position: "top-left",
      margin: 0,
      scale: 0.4,
      opacity: 0.5,
    });
    // mark covers (0..3, 0..3): red at 50% over grey 100 -> (177.5, 50, 50) ~ (178, 50, 50)
    const inside = px(out, 1, 1);
    expect(Math.abs(inside[0]! - 178)).toBeLessThanOrEqual(1);
    expect(inside[1]).toBe(50);
    expect(px(out, 9, 9)).toEqual([100, 100, 100, 255]); // untouched corner
  });
  it("opacity 1 replaces pixels under an opaque mark", () => {
    const base = solid(10, 10, 100, 100, 100);
    const mark = solid(2, 2, 0, 255, 0);
    const out = applyWatermark(base, mark, {
      position: "center",
      margin: 0,
      scale: 0.2,
      opacity: 1,
    });
    expect(px(out, 5, 5)).toEqual([0, 255, 0, 255]);
  });
  it("does not mutate the input", () => {
    const base = solid(10, 10, 100, 100, 100);
    const before = Array.from(base.data);
    applyWatermark(base, solid(2, 2, 255, 0, 0), { opacity: 1 });
    expect(Array.from(base.data)).toEqual(before);
  });
});
