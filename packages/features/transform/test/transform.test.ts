import { describe, expect, it } from "vitest";
import {
  fillBackground,
  flipHorizontal,
  flipVertical,
  rotateQuarter,
  type PixelData,
} from "../src/index.js";
import { applyMatrix, perspectiveMatrix, warpPerspective } from "../src/perspective.js";

// 2x2: red green / blue white, each tagged by its red channel order.
function fixture(): PixelData {
  return {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
    ]),
  };
}
const px = (p: PixelData, x: number, y: number) =>
  Array.from(p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 4));

describe("flips", () => {
  it("flipHorizontal mirrors columns", () => {
    const out = flipHorizontal(fixture());
    expect(px(out, 0, 0)).toEqual([0, 255, 0, 255]);
    expect(px(out, 1, 0)).toEqual([255, 0, 0, 255]);
    expect(px(out, 0, 1)).toEqual([255, 255, 255, 255]);
  });
  it("flipVertical mirrors rows", () => {
    const out = flipVertical(fixture());
    expect(px(out, 0, 0)).toEqual([0, 0, 255, 255]);
    expect(px(out, 0, 1)).toEqual([255, 0, 0, 255]);
  });
  it("double flip is identity", () => {
    const out = flipVertical(flipHorizontal(flipVertical(flipHorizontal(fixture()))));
    expect(Array.from(out.data)).toEqual(Array.from(fixture().data));
  });
});

describe("rotateQuarter", () => {
  it("one CW turn swaps dimensions and rotates", () => {
    const out = rotateQuarter(fixture(), 1);
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    // CW: blue (bottom-left) -> top-left
    expect(px(out, 0, 0)).toEqual([0, 0, 255, 255]);
    expect(px(out, 1, 0)).toEqual([255, 0, 0, 255]);
    expect(px(out, 1, 1)).toEqual([0, 255, 0, 255]);
    expect(px(out, 0, 1)).toEqual([255, 255, 255, 255]);
  });
  it("two turns = 180", () => {
    const out = rotateQuarter(fixture(), 2);
    expect(px(out, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(px(out, 1, 1)).toEqual([255, 0, 0, 255]);
  });
  it("four turns = identity copy, -1 = one CCW turn", () => {
    const id = rotateQuarter(fixture(), 4);
    expect(Array.from(id.data)).toEqual(Array.from(fixture().data));
    const ccw = rotateQuarter(fixture(), -1);
    expect(px(ccw, 0, 0)).toEqual([0, 255, 0, 255]);
  });
  it("rejects fractional turns", () => {
    expect(() => rotateQuarter(fixture(), 0.5)).toThrow(RangeError);
  });
});

describe("fillBackground", () => {
  it("composites transparent pixels over the colour", () => {
    const input: PixelData = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([0, 0, 0, 0, 255, 0, 0, 128]),
    };
    const out = fillBackground(input, { r: 255, g: 255, b: 255 });
    expect(px(out, 0, 0)).toEqual([255, 255, 255, 255]);
    const half = px(out, 1, 0);
    expect(half[0]).toBeGreaterThan(250); // red over white stays red-dominant
    expect(half[3]).toBe(255);
  });
});

describe("perspective", () => {
  const unit: readonly [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  it("identity quad gives an identity matrix", () => {
    const m = perspectiveMatrix(unit, unit);
    const p = applyMatrix(m, { x: 0.25, y: 0.75 });
    expect(p.x).toBeCloseTo(0.25, 9);
    expect(p.y).toBeCloseTo(0.75, 9);
  });
  it("scale quad maps corners exactly", () => {
    const scaled = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ] as typeof unit;
    const m = perspectiveMatrix(unit, scaled);
    const p = applyMatrix(m, { x: 1, y: 1 });
    expect(p.x).toBeCloseTo(2, 9);
    expect(p.y).toBeCloseTo(2, 9);
  });
  it("warp with the identity matrix reproduces the source", () => {
    const src = fixture();
    const m = perspectiveMatrix(
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ],
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ],
    );
    const out = warpPerspective(src, m, { width: 2, height: 2, sampling: "nearest" });
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });
});
