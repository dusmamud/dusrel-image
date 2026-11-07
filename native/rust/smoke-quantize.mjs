// Functional smoke gate for the quantize module (runs INSIDE the
// Docker build). A 64x64 gradient has 4096 distinct colours;
// quantizing to 16 must yield <=16 palette entries, one index per
// pixel, all indices in range, a finite positive error, and a
// remapped image that is still recognisably the same gradient.
import { readFileSync } from "node:fs";

const glue = await import("./out/quantize.mjs");
await glue.default({ module_or_path: readFileSync("./out/quantize.wasm") });
if (typeof glue.dusrel_quantize !== "function") {
  console.error("SMOKE FAIL: dusrel_quantize missing");
  process.exit(1);
}
const W = 64;
const H = 64;
const rgba = new Uint8Array(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    rgba[i] = (x * 4) & 0xff;
    rgba[i + 1] = (y * 4) & 0xff;
    rgba[i + 2] = ((x + y) * 2) & 0xff;
    rgba[i + 3] = 255;
  }
}
const out = glue.dusrel_quantize(rgba, W, H, 16, 1.0);
const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
const count = view.getUint32(0, true);
const error = view.getFloat32(4, true);
const palette = out.subarray(8, 8 + count * 4);
const indices = out.subarray(8 + count * 4);
if (count < 2 || count > 16) {
  console.error("SMOKE FAIL: palette count", count);
  process.exit(1);
}
if (indices.length !== W * H || indices.some((ix) => ix >= count)) {
  console.error("SMOKE FAIL: indices malformed");
  process.exit(1);
}
if (!Number.isFinite(error) || error <= 0) {
  console.error("SMOKE FAIL: error metric", error);
  process.exit(1);
}
let totalDiff = 0;
for (let p = 0; p < W * H; p++) {
  const pal = indices[p] * 4;
  for (let c = 0; c < 3; c++) totalDiff += Math.abs(palette[pal + c] - rgba[p * 4 + c]);
}
const meanDiff = totalDiff / (W * H * 3);
if (meanDiff > 32) {
  console.error("SMOKE FAIL: remapped image drifted too far, mean channel diff", meanDiff);
  process.exit(1);
}
console.log(
  `SMOKE OK: quantize 4096 colours -> ${count} palette entries, error ${error.toFixed(2)}, mean diff ${meanDiff.toFixed(1)}`,
);
