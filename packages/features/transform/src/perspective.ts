import type { PixelData, Point, Quad } from "./types.js";

/**
 * Computes the 3x3 perspective (homography) matrix that maps the
 * source quad onto the destination quad, as 9 row-major numbers
 * with m[8] normalised to 1. Pure math (an 8x8 linear solve).
 */
export function perspectiveMatrix(from: Quad, to: Quad): Float64Array {
  // For each correspondence (x,y) -> (u,v):
  //   u = (a x + b y + c) / (g x + h y + 1)
  //   v = (d x + e y + f) / (g x + h y + 1)
  // Linearised: a x + b y + c - g x u - h y u = u (and the v twin).
  const rows: number[][] = [];
  const rhs: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]!;
    const { x: u, y: v } = to[i]!;
    rows.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    rhs.push(u);
    rows.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    rhs.push(v);
  }
  const sol = solve8(rows, rhs);
  return new Float64Array([
    sol[0]!,
    sol[1]!,
    sol[2]!,
    sol[3]!,
    sol[4]!,
    sol[5]!,
    sol[6]!,
    sol[7]!,
    1,
  ]);
}

function solve8(a: number[][], b: number[]): number[] {
  const n = 8;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-12) {
      throw new Error("Degenerate quad: the perspective matrix is singular.");
    }
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const div = m[col]![col]!;
    for (let j = col; j <= n; j++) m[col]![j]! /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r]![col]!;
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) m[r]![j]! -= factor * m[col]![j]!;
    }
  }
  return m.map((row) => row[n]!);
}

/** Applies a 3x3 matrix to a point (with perspective divide). */
export function applyMatrix(m: Float64Array, p: Point): Point {
  const w = m[6]! * p.x + m[7]! * p.y + m[8]!;
  return {
    x: (m[0]! * p.x + m[1]! * p.y + m[2]!) / w,
    y: (m[3]! * p.x + m[4]! * p.y + m[5]!) / w,
  };
}

/** Inverts a 3x3 matrix (used to map output pixels back to source space). */
export function invertMatrix(m: Float64Array): Float64Array {
  const [a, b, c, d, e, f, g, h, i] = [
    m[0]!,
    m[1]!,
    m[2]!,
    m[3]!,
    m[4]!,
    m[5]!,
    m[6]!,
    m[7]!,
    m[8]!,
  ];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-15) throw new Error("Matrix is not invertible.");
  const inv = 1 / det;
  return new Float64Array([
    (e * i - f * h) * inv,
    (c * h - b * i) * inv,
    (b * f - c * e) * inv,
    (f * g - d * i) * inv,
    (a * i - c * g) * inv,
    (c * d - a * f) * inv,
    (d * h - e * g) * inv,
    (b * g - a * h) * inv,
    (a * e - b * d) * inv,
  ]);
}

export interface WarpOptions {
  width: number;
  height: number;
  /** Sampling for fractional source positions. Default 'bilinear'. */
  sampling?: "nearest" | "bilinear";
}

/**
 * CPU perspective warp: renders the source image through a
 * homography into a new width x height PixelData. Correct and
 * dependency-free; for very large images prefer doing perspective
 * work in a worker (this is a per-pixel loop by design).
 */
export function warpPerspective(
  pixels: PixelData,
  matrix: Float64Array,
  options: WarpOptions,
): PixelData {
  if (pixels.data.length !== pixels.width * pixels.height * 4) {
    throw new RangeError("PixelData length does not match its dimensions.");
  }
  if (
    !Number.isInteger(options.width) ||
    options.width <= 0 ||
    !Number.isInteger(options.height) ||
    options.height <= 0
  ) {
    throw new RangeError("Warp output dimensions must be positive integers.");
  }
  const sampling = options.sampling ?? "bilinear";
  const inverse = invertMatrix(matrix);
  const out: PixelData = {
    data: new Uint8ClampedArray(options.width * options.height * 4),
    width: options.width,
    height: options.height,
  };
  const { width: sw, height: sh } = pixels;
  const sample = (sx: number, sy: number, dst: number) => {
    if (sampling === "nearest") {
      const x = Math.round(sx);
      const y = Math.round(sy);
      if (x < 0 || y < 0 || x >= sw || y >= sh) return;
      const s = (y * sw + x) * 4;
      for (let c = 0; c < 4; c++) out.data[dst + c] = pixels.data[s + c]!;
      return;
    }
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const fx = sx - x0;
    const fy = sy - y0;
    for (let c = 0; c < 4; c++) {
      let value = 0;
      const taps: Array<[number, number, number]> = [
        [x0, y0, (1 - fx) * (1 - fy)],
        [x0 + 1, y0, fx * (1 - fy)],
        [x0, y0 + 1, (1 - fx) * fy],
        [x0 + 1, y0 + 1, fx * fy],
      ];
      for (const [tx, ty, weight] of taps) {
        if (weight === 0 || tx < 0 || ty < 0 || tx >= sw || ty >= sh) continue;
        value += pixels.data[(ty * sw + tx) * 4 + c]! * weight;
      }
      out.data[dst + c] = value;
    }
  };
  for (let y = 0; y < options.height; y++) {
    for (let x = 0; x < options.width; x++) {
      const src = applyMatrix(inverse, { x, y });
      sample(src.x, src.y, (y * options.width + x) * 4);
    }
  }
  return out;
}
