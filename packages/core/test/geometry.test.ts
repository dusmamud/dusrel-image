import { describe, expect, it } from "vitest";
import {
  normalizeRotation,
  planTransform,
  resizedDimensions,
  rotatedDimensions,
  validateCrop,
} from "../src/geometry.js";
import { DusrelImageError } from "../src/errors.js";

describe("normalizeRotation", () => {
  it("wraps values into [0, 360)", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
  });
  it("rejects non-finite values", () => {
    expect(() => normalizeRotation(Number.NaN)).toThrowError(DusrelImageError);
  });
});

describe("rotatedDimensions", () => {
  it("swaps width and height at 90 degrees", () => {
    expect(rotatedDimensions(400, 200, 90)).toEqual({ width: 200, height: 400 });
    expect(rotatedDimensions(400, 200, 270)).toEqual({ width: 200, height: 400 });
  });
  it("keeps size at 0 and 180 degrees", () => {
    expect(rotatedDimensions(400, 200, 0)).toEqual({ width: 400, height: 200 });
    expect(rotatedDimensions(400, 200, 180)).toEqual({ width: 400, height: 200 });
  });
  it("grows the bounding box at 45 degrees", () => {
    const d = rotatedDimensions(100, 100, 45);
    expect(d.width).toBe(141);
    expect(d.height).toBe(141);
  });
});

describe("validateCrop", () => {
  const source = { width: 400, height: 200 };
  it("accepts a crop inside the source", () => {
    expect(validateCrop(source, { x: 10, y: 10, width: 100, height: 50 })).toEqual({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
    });
  });
  it("rejects a crop that overflows the source", () => {
    expect(() => validateCrop(source, { x: 350, y: 0, width: 100, height: 50 })).toThrowError(
      /does not lie inside/,
    );
  });
  it("rejects empty crops", () => {
    expect(() => validateCrop(source, { x: 0, y: 0, width: 0, height: 10 })).toThrowError(
      DusrelImageError,
    );
  });
});

describe("resizedDimensions", () => {
  const source = { width: 400, height: 200 };
  it("inside: fits within the box preserving aspect", () => {
    expect(resizedDimensions(source, { width: 100 })).toEqual({ width: 100, height: 50 });
    expect(resizedDimensions(source, { height: 100 })).toEqual({ width: 200, height: 100 });
    expect(resizedDimensions(source, { width: 100, height: 100 })).toEqual({
      width: 100,
      height: 50,
    });
  });
  it("cover and fill return the exact box", () => {
    expect(resizedDimensions(source, { width: 100, height: 100, fit: "cover" })).toEqual({
      width: 100,
      height: 100,
    });
    expect(resizedDimensions(source, { width: 100, height: 100, fit: "fill" })).toEqual({
      width: 100,
      height: 100,
    });
  });
  it("cover requires both dimensions", () => {
    expect(() => resizedDimensions(source, { width: 100, fit: "cover" })).toThrowError(
      /requires both/,
    );
  });
  it("rejects an empty resize", () => {
    expect(() => resizedDimensions(source, {})).toThrowError(/at least one of width or height/);
  });
});

describe("planTransform", () => {
  it("composes crop, rotate and resize", () => {
    const plan = planTransform(
      { width: 800, height: 600 },
      { crop: { x: 0, y: 0, width: 400, height: 600 }, rotate: 90, resize: { width: 300 } },
    );
    expect(plan.croppedSize).toEqual({ width: 400, height: 600 });
    expect(plan.rotatedSize).toEqual({ width: 600, height: 400 });
    expect(plan.outputSize).toEqual({ width: 300, height: 200 });
    expect(plan.rotation).toBe(90);
  });
  it("defaults to the full frame, unrotated", () => {
    const plan = planTransform({ width: 320, height: 240 }, {});
    expect(plan.crop).toEqual({ x: 0, y: 0, width: 320, height: 240 });
    expect(plan.outputSize).toEqual({ width: 320, height: 240 });
  });
});
