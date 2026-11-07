/**
 * Structural pixel container — exactly the shape of the DOM
 * ImageData, declared structurally so the pure functions in this
 * package run (and are unit-tested) anywhere, DOM or not.
 */
export interface PixelData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface Point {
  x: number;
  y: number;
}

/** A quadrilateral: [top-left, top-right, bottom-right, bottom-left]. */
export type Quad = readonly [Point, Point, Point, Point];
