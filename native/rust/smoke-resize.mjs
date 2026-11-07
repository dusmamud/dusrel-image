// Functional smoke gate for the resize module (runs INSIDE the
// Docker build). Deterministic checks only: nearest upscale must
// replicate exact source pixels; a lanczos downscale of a solid
// colour must return that colour; the prefix framing must be right.
import { readFileSync } from "node:fs";

const glue = await import("./out/resize.mjs");
await glue.default({ module_or_path: readFileSync("./out/resize.wasm") });
if (typeof glue.dusrel_resize !== "function") {
  console.error("SMOKE FAIL: dusrel_resize missing");
  process.exit(1);
}
function parse(out) {
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  return { w: view.getUint32(0, true), h: view.getUint32(4, true), px: out.subarray(8) };
}
// 2x2: red, green / blue, white
const src = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
// nearest 2x2 -> 4x4: each source pixel becomes a 2x2 block
const up = parse(glue.dusrel_resize(src, 2, 2, 4, 4, 0, true));
if (up.w !== 4 || up.h !== 4 || up.px.length !== 64) {
  console.error("SMOKE FAIL: upscale framing");
  process.exit(1);
}
const at = (x, y) => Array.from(up.px.subarray((y * 4 + x) * 4, (y * 4 + x) * 4 + 4));
if (
  JSON.stringify(at(0, 0)) !== "[255,0,0,255]" ||
  JSON.stringify(at(3, 0)) !== "[0,255,0,255]" ||
  JSON.stringify(at(0, 3)) !== "[0,0,255,255]" ||
  JSON.stringify(at(3, 3)) !== "[255,255,255,255]"
) {
  console.error("SMOKE FAIL: nearest upscale pixels wrong", at(0, 0), at(3, 3));
  process.exit(1);
}
// lanczos3 downscale of a solid colour stays that colour
const solid = new Uint8Array(8 * 8 * 4);
for (let i = 0; i < 64; i++) {
  solid[i * 4] = 40;
  solid[i * 4 + 1] = 120;
  solid[i * 4 + 2] = 200;
  solid[i * 4 + 3] = 255;
}
const down = parse(glue.dusrel_resize(solid, 8, 8, 3, 3, 6, true));
const mid = Array.from(down.px.subarray(16, 20));
if (down.w !== 3 || down.h !== 3 || JSON.stringify(mid) !== "[40,120,200,255]") {
  console.error("SMOKE FAIL: lanczos solid downscale", down.w, down.h, mid);
  process.exit(1);
}
console.log("SMOKE OK: resize nearest blocks exact, lanczos solid stable, framing correct");
