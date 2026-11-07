import { describe, expect, it } from "vitest";
import {
  clampCrop,
  displayToNatural,
  fitRect,
  initialCrop,
  moveCrop,
  naturalToDisplay,
  resizeCrop,
} from "../src/index.js";

const IMG = { width: 1000, height: 500 };

describe("initialCrop", () => {
  it("centres an 80% crop", () => {
    expect(initialCrop(IMG)).toEqual({ x: 100, y: 50, width: 800, height: 400 });
  });
  it("fits the aspect inside the coverage box", () => {
    const r = initialCrop(IMG, { aspect: 16 / 9, coverage: 1 });
    // box 1000x500; width limited by height: 500 * 16/9 = 888.9 -> 889, height 500
    expect(r.height).toBe(500);
    expect(Math.abs(r.width - 889)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.x - (1000 - r.width) / 2)).toBeLessThanOrEqual(1);
    expect(r.y).toBe(0);
  });
  it("circle shape forces a square", () => {
    const r = initialCrop(IMG, { shape: "circle" });
    expect(r.width).toBe(r.height);
  });
});

describe("clampCrop", () => {
  it("pulls an out-of-bounds rect inside", () => {
    expect(clampCrop({ x: -50, y: -50, width: 2000, height: 100 }, IMG)).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 100,
    });
  });
  it("enforces the aspect by deriving height", () => {
    const r = clampCrop({ x: 0, y: 0, width: 100, height: 100 }, IMG, { aspect: 2 });
    expect(r).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });
  it("respects min sizes", () => {
    const r = clampCrop({ x: 0, y: 0, width: 5, height: 5 }, IMG, { minWidth: 40, minHeight: 30 });
    expect(r.width).toBe(40);
    expect(r.height).toBe(30);
  });
});

describe("moveCrop", () => {
  it("moves and clamps at the edge", () => {
    const r = moveCrop({ x: 900, y: 0, width: 100, height: 100 }, 500, 0, IMG);
    expect(r.x).toBe(900);
  });
  it("moves freely inside", () => {
    expect(moveCrop({ x: 10, y: 10, width: 50, height: 50 }, 5, -5, IMG)).toEqual({
      x: 15,
      y: 5,
      width: 50,
      height: 50,
    });
  });
});

describe("resizeCrop", () => {
  const base = { x: 100, y: 100, width: 200, height: 100 };
  it("se grows width and height, anchored at nw", () => {
    expect(resizeCrop(base, "se", 50, 25, IMG)).toEqual({
      x: 100,
      y: 100,
      width: 250,
      height: 125,
    });
  });
  it("nw moves the origin, anchored at se", () => {
    expect(resizeCrop(base, "nw", 20, 10, IMG)).toEqual({ x: 120, y: 110, width: 180, height: 90 });
  });
  it("aspect corner drag is driven by the dominant axis", () => {
    const r = resizeCrop(base, "se", 100, 0, IMG, { aspect: 2 });
    expect(r.width).toBe(300);
    expect(r.height).toBe(150);
    expect(r.x).toBe(100);
  });
  it("aspect edge drag keeps the perpendicular centre", () => {
    const r = resizeCrop(base, "e", 100, 0, IMG, { aspect: 2 });
    expect(r.width).toBe(300);
    expect(r.height).toBe(150);
    expect(r.y + r.height / 2).toBe(150); // centre preserved
  });
});

describe("display mapping", () => {
  it("fitRect contain-fits and centres", () => {
    expect(fitRect({ width: 400, height: 300 }, { width: 200, height: 200 })).toEqual({
      x: 0,
      y: 25,
      width: 200,
      height: 150,
      scale: 0.5,
    });
  });
  it("natural <-> display round-trips", () => {
    const natural = { x: 10, y: 20, width: 100, height: 50 };
    expect(displayToNatural(naturalToDisplay(natural, 0.5), 0.5)).toEqual(natural);
  });
});
