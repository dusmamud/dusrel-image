import { describe, expect, it } from "vitest";
import {
  adjust,
  boxBlur,
  grayscale,
  invert,
  resolveAdjustOptions,
  sepia,
  sharpen,
  type PixelData,
} from "../src/index.js";

function one(r: number, g: number, b: number, a = 255): PixelData {
  return { width: 1, height: 1, data: new Uint8ClampedArray([r, g, b, a]) };
}
const px = (p: PixelData) => Array.from(p.data);

describe("resolveAdjustOptions", () => {
  it("defaults everything to no-op", () => {
    expect(resolveAdjustOptions()).toEqual({
      brightness: 0,
      contrast: 0,
      exposure: 0,
      gamma: 1,
      saturation: 0,
      hueRotate: 0,
      grayscale: false,
      sepia: false,
      invert: false,
    });
  });
  it("rejects out-of-range values", () => {
    expect(() => resolveAdjustOptions({ brightness: 2 })).toThrow(RangeError);
    expect(() => resolveAdjustOptions({ gamma: 0 })).toThrow(RangeError);
    expect(() => resolveAdjustOptions({ gamma: -1 })).toThrow(RangeError);
    expect(() => resolveAdjustOptions({ hueRotate: Number.NaN })).toThrow(RangeError);
  });
});

describe("adjust point ops (exact known values)", () => {
  it("no-op returns identical pixels", () => {
    expect(px(adjust(one(10, 100, 200)))).toEqual([10, 100, 200, 255]);
  });
  it("brightness +1 saturates to white; -1 to black", () => {
    expect(px(adjust(one(10, 100, 200), { brightness: 1 }))).toEqual([255, 255, 255, 255]);
    expect(px(adjust(one(10, 100, 200), { brightness: -1 }))).toEqual([0, 0, 0, 255]);
  });
  it("exposure +1 doubles", () => {
    expect(px(adjust(one(50, 60, 70), { exposure: 1 }))).toEqual([100, 120, 140, 255]);
  });
  it("gamma 2 darkens mid-tones predictably", () => {
    // 64 -> 255 * (64/255)^0.5 = 255 * 0.501 = 127.75 -> 128 (approx, Uint8Clamped rounds)
    const out = px(adjust(one(64, 64, 64), { gamma: 2 }));
    expect(out[0]).toBeGreaterThanOrEqual(127);
    expect(out[0]).toBeLessThanOrEqual(128);
  });
  it("saturation -1 equals grayscale luminance", () => {
    const viaSat = px(adjust(one(255, 0, 0), { saturation: -1 }));
    const viaGray = px(grayscale(one(255, 0, 0)));
    expect(Math.abs(viaSat[0]! - viaGray[0]!)).toBeLessThanOrEqual(1);
    expect(viaSat[0]).toBe(viaSat[1]);
    expect(viaSat[1]).toBe(viaSat[2]);
  });
  it("grayscale of pure red is the Rec.709 luminance (54)", () => {
    // 0.2126 * 255 = 54.2
    expect(px(grayscale(one(255, 0, 0)))).toEqual([54, 54, 54, 255]);
  });
  it("sepia of white stays near-white and warm", () => {
    const out = px(sepia(one(255, 255, 255)));
    expect(out[0]).toBe(255);
    expect(out[2]).toBeLessThan(out[0]!);
  });
  it("invert flips channels and leaves alpha alone", () => {
    expect(px(invert(one(10, 200, 90, 128)))).toEqual([245, 55, 165, 128]);
  });
  it("hueRotate 360 is a no-op (within rounding)", () => {
    const out = px(adjust(one(200, 30, 90), { hueRotate: 360 }));
    expect(Math.abs(out[0]! - 200)).toBeLessThanOrEqual(1);
    expect(Math.abs(out[1]! - 30)).toBeLessThanOrEqual(1);
  });
});

describe("convolutions", () => {
  const impulse: PixelData = {
    width: 3,
    height: 3,
    data: new Uint8ClampedArray(36),
  };
  impulse.data.set([255, 255, 255, 255], (1 * 3 + 1) * 4);

  it("sharpen keeps a solid field unchanged", () => {
    const solid: PixelData = { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(80) };
    solid.data[3] = 255;
    const out = sharpen(solid, 1);
    expect(px(out)[0]).toBe(80);
  });
  it("box blur spreads the impulse evenly at radius 1 (centre = 255/9)", () => {
    const out = boxBlur(impulse, 1);
    expect(out.data[(1 * 3 + 1) * 4]).toBe(28); // 255/9 = 28.33
    expect(out.data[0]).toBe(28);
  });
  it("box blur radius 0 is identity", () => {
    const out = boxBlur(impulse, 0);
    expect(Array.from(out.data)).toEqual(Array.from(impulse.data));
  });
});
