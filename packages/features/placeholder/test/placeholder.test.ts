import { describe, expect, it } from "vitest";
import * as pkg from "../src/index.js";
import {
  averageColor,
  blurHashComponents,
  decodeBlurHash,
  decodeThumbHash,
  encodeBlurHash,
  encodeThumbHash,
  isValidBlurHash,
  thumbHashAspectRatio,
  thumbHashAverageColor,
  thumbHashFromBase64,
  thumbHashToBase64,
} from "../src/index.js";
import type { PixelData } from "../src/index.js";

function solid(w: number, h: number, [r, g, b, a]: [number, number, number, number]): PixelData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([r, g, b, a], i * 4);
  return { data, width: w, height: h };
}

function gradient(w: number, h: number): PixelData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = Math.round((x / (w - 1)) * 255);
      data[i + 1] = Math.round((y / (h - 1)) * 255);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

function alphaPattern(w: number, h: number): PixelData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = x < w / 2 ? 255 : 0;
      data[i + 1] = y < h / 2 ? 255 : 0;
      data[i + 2] = 64;
      data[i + 3] = Math.round(((x + y) / (w + h - 2)) * 255);
    }
  }
  return { data, width: w, height: h };
}

function px(data: PixelData, x: number, y: number): [number, number, number, number] {
  const i = (y * data.width + x) * 4;
  return [
    data.data[i] as number,
    data.data[i + 1] as number,
    data.data[i + 2] as number,
    data.data[i + 3] as number,
  ];
}

function expectPixelClose(
  actual: [number, number, number, number],
  expected: number[],
  tolerance = 1,
) {
  for (let c = 0; c < 4; c++) {
    expect(Math.abs((actual[c] as number) - (expected[c] as number))).toBeLessThanOrEqual(
      tolerance,
    );
  }
}

/**
 * ORACLE VECTORS — produced by the reference implementations
 * (thumbhash@0.1.1, Evan Wallace's JS; blurhash@2.0.5, Wolt's
 * TS) on 2026-11-08 for exactly the inputs built above. If a
 * vector fails, this port drifted from the reference format —
 * never "fix" a vector to match the port.
 */
const ORACLE = {
  solid: {
    input: () => solid(4, 4, [200, 30, 60, 255]),
    thumb: "mFkDBwBpUh93iHiFeBh3V4hvg2EGDIgD",
    thumbAspect: 1,
    thumbAverage: { r: 0.7910052910052909, g: 0.10846560846560838, b: 0.24338624338624343, a: 1 },
    thumbDecodeSize: [32, 32],
    thumbFirst: [201, 27, 62, 255],
    thumbLastRowFirst: [201, 27, 62, 255],
    blur: "LlM^#R|yfQ|y|yw{fQw{fQfQfQfQ",
    blurDecode: [
      [255, 49, 108, 255],
      [229, 26, 76, 255],
      [5, 24, 0, 255],
    ],
  },
  gradient: {
    input: () => gradient(8, 4),
    thumb: "4AcORKJxh3eAiHeHiIdxcBf3iA==",
    thumbAspect: 1.75,
    thumbAverage: { r: 0.5105820105820105, g: 0.49470899470899465, b: 0.5185185185185185, a: 1 },
    thumbDecodeSize: [32, 18],
    thumbFirst: [0, 0, 151, 255],
    thumbLastRowFirst: [0, 255, 128, 255],
    blur: "LRI5u53.a|?Z_e9~fQredLeqfQeq",
    blurDecode: [
      [160, 102, 181, 255],
      [121, 210, 121, 255],
      [128, 137, 78, 255],
    ],
  },
  portrait: {
    input: () => gradient(4, 8),
    thumb: "4AcORCJwF4d4iIeIeHdwcQfnhw==",
    thumbAspect: 0.5714285714285714,
    thumbAverage: { r: 0.5105820105820105, g: 0.49470899470899465, b: 0.5185185185185185, a: 1 },
    thumbDecodeSize: [18, 32],
    thumbFirst: [0, 0, 151, 255],
    thumbLastRowFirst: [0, 255, 136, 255],
    blur: "LqI=0o3.A=~Az4RCSMrKf7fQfQfQ",
    blurDecode: [
      [135, 124, 189, 255],
      [97, 255, 155, 255],
      [154, 139, 62, 255],
    ],
  },
  alpha: {
    input: () => alphaPattern(6, 6),
    thumb: "1AiGJRQob3Q/h3ZIeG8/9gaYcHdweId4dw==",
    thumbAspect: 1,
    thumbAverage: {
      r: 0.3624338624338624,
      g: 0.34656084656084657,
      b: 0.24338624338624334,
      a: 0.5333333333333333,
    },
    thumbDecodeSize: [32, 32],
    thumbFirst: [109, 98, 35, 0],
    thumbLastRowFirst: [192, 0, 56, 136],
    blur: "L~Lqcp}q;$ge*C%IsUgdg]g0fQg0",
    blurDecode: [
      [255, 255, 104, 255],
      [251, 161, 73, 255],
      [126, 120, 12, 255],
    ],
  },
} as const;

describe("thumbhash oracle vectors", () => {
  for (const [name, v] of Object.entries(ORACLE)) {
    it(`encodes ${name} byte-identically to the reference`, () => {
      expect(thumbHashToBase64(encodeThumbHash(v.input()))).toBe(v.thumb);
    });

    it(`reads ${name} aspect + average from the reference hash`, () => {
      const hash = thumbHashFromBase64(v.thumb);
      expect(thumbHashAspectRatio(hash)).toBeCloseTo(v.thumbAspect, 10);
      const avg = thumbHashAverageColor(hash);
      expect(avg.r).toBeCloseTo(v.thumbAverage.r, 10);
      expect(avg.g).toBeCloseTo(v.thumbAverage.g, 10);
      expect(avg.b).toBeCloseTo(v.thumbAverage.b, 10);
      expect(avg.a).toBeCloseTo(v.thumbAverage.a, 10);
    });

    it(`decodes the reference ${name} hash to the reference size/pixels`, () => {
      const out = decodeThumbHash(thumbHashFromBase64(v.thumb));
      expect([out.width, out.height]).toEqual(v.thumbDecodeSize);
      expectPixelClose(px(out, 0, 0), v.thumbFirst as unknown as number[]);
      expectPixelClose(px(out, 0, out.height - 1), v.thumbLastRowFirst as unknown as number[]);
    });
  }
});

describe("blurhash oracle vectors", () => {
  for (const [name, v] of Object.entries(ORACLE)) {
    it(`encodes ${name} string-identically to the reference`, () => {
      expect(encodeBlurHash(v.input())).toBe(v.blur);
    });

    it(`decodes the reference ${name} hash byte-identically at 8x8`, () => {
      const out = decodeBlurHash(v.blur, 8, 8);
      expect(px(out, 0, 0)).toEqual(v.blurDecode[0]);
      expect(px(out, 0, 7)).toEqual(v.blurDecode[1]);
      expect(px(out, 7, 7)).toEqual(v.blurDecode[2]);
    });
  }
});

describe("blurhash behaviour", () => {
  it("reports components and validity", () => {
    expect(blurHashComponents(ORACLE.gradient.blur)).toEqual({ componentX: 4, componentY: 3 });
    expect(isValidBlurHash(ORACLE.gradient.blur)).toBe(true);
    expect(isValidBlurHash("too short")).toBe(false);
    expect(isValidBlurHash("LEHV6nWB2yk8pyo0adR*.7kCMdnj")).toBe(true);
  });

  it("honours custom component counts", () => {
    const hash = encodeBlurHash(gradient(8, 4), { componentX: 3, componentY: 2 });
    expect(hash).toHaveLength(4 + 2 * 3 * 2);
    expect(blurHashComponents(hash)).toEqual({ componentX: 3, componentY: 2 });
  });

  it("rejects bad component counts and bad hashes", () => {
    expect(() => encodeBlurHash(gradient(4, 4), { componentX: 0 })).toThrow(RangeError);
    expect(() => encodeBlurHash(gradient(4, 4), { componentY: 10 })).toThrow(RangeError);
    expect(() => decodeBlurHash("abc", 8, 8)).toThrow(RangeError);
    expect(() => decodeBlurHash(ORACLE.solid.blur.slice(0, -2), 8, 8)).toThrow(RangeError);
    expect(() => decodeBlurHash(ORACLE.solid.blur, 0, 8)).toThrow(RangeError);
  });
});

describe("thumbhash behaviour", () => {
  it("round-trips base64 helpers and rejects garbage", () => {
    const hash = encodeThumbHash(gradient(8, 4));
    expect(thumbHashFromBase64(thumbHashToBase64(hash))).toEqual(hash);
    expect(() => thumbHashFromBase64("!!!not-base64!!!")).toThrow(RangeError);
  });

  it("rejects truncated hashes", () => {
    const hash = thumbHashFromBase64(ORACLE.gradient.thumb);
    expect(() => decodeThumbHash(hash.slice(0, 6))).toThrow(RangeError);
    expect(() => decodeThumbHash(new Uint8Array(3))).toThrow(RangeError);
  });

  it("downscales oversize inputs to the 100px format cap", () => {
    const big = solid(240, 120, [10, 120, 200, 255]);
    const out = decodeThumbHash(encodeThumbHash(big));
    // ThumbHash aspect is approximate by design: 240x120 hashes
    // as lx=7, ly=4 (ratio 1.75), which decodes at 32x18.
    expect(out.width).toBe(32);
    expect(out.height).toBe(18);
    // DC terms are 6-bit quantised in LPQ space, so a roundtrip
    // lands within a few units (the reference solid-colour
    // vector above is off by 3 in one channel).
    expectPixelClose(px(out, 0, 0), [10, 120, 200, 255], 4);
  });
});

describe("averageColor + input validation", () => {
  it("averages a solid colour exactly", () => {
    expect(averageColor(solid(3, 2, [10, 20, 30, 40]))).toEqual({ r: 10, g: 20, b: 30, a: 40 });
  });

  it("rejects malformed PixelData everywhere", () => {
    const bad = { data: new Uint8ClampedArray(3), width: 2, height: 2 };
    expect(() => encodeThumbHash(bad)).toThrow(RangeError);
    expect(() => encodeBlurHash(bad)).toThrow(RangeError);
    expect(() => averageColor(bad)).toThrow(RangeError);
  });
});

describe("public surface", () => {
  it("exports every documented function", () => {
    for (const name of [
      "averageColor",
      "blurHashComponents",
      "decodeBlurHash",
      "decodeThumbHash",
      "encodeBlurHash",
      "encodeThumbHash",
      "isValidBlurHash",
      "thumbHashAspectRatio",
      "thumbHashAverageColor",
      "thumbHashFromBase64",
      "thumbHashToBase64",
    ]) {
      expect(typeof (pkg as Record<string, unknown>)[name], name).toBe("function");
    }
  });
});
