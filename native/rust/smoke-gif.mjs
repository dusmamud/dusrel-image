// Functional smoke gate for the gif WASM module: a green build is
// NOT proof (the AVIF lesson). Encode real frames, check the
// GIF89a header, decode, compare pixels/delays/repeat exactly.
import { readFile } from "node:fs/promises";
import init, { dusrel_gif_decode, dusrel_gif_encode } from "./out/gif.mjs";

const wasmBytes = await readFile(new URL("./out/gif.wasm", import.meta.url));
await init({ module_or_path: wasmBytes });

const W = 16;
const H = 16;
function solid(r, g, b) {
  const px = new Uint8Array(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    px[p * 4] = r;
    px[p * 4 + 1] = g;
    px[p * 4 + 2] = b;
    px[p * 4 + 3] = 255;
  }
  return px;
}
const frames = new Uint8Array([...solid(255, 0, 0), ...solid(0, 255, 0)]);
const delays = new Uint8Array([10, 0, 20, 0]); // u16 LE centiseconds

function decodeAll(bytes) {
  const out = dusrel_gif_decode(bytes);
  const dv = new DataView(out.buffer, out.byteOffset);
  const w = dv.getUint32(0, true);
  const h = dv.getUint32(4, true);
  const count = dv.getUint32(8, true);
  const repeat = dv.getInt32(12, true);
  const frameSize = w * h * 4;
  const result = [];
  let off = 16;
  for (let i = 0; i < count; i++) {
    result.push({ delay: dv.getUint16(off, true), px: out.slice(off + 2, off + 2 + frameSize) });
    off += 2 + frameSize;
  }
  return { w, h, count, repeat, frames: result };
}
function expectPx(px, r, g, b, label) {
  for (let p = 0; p < W * H; p++) {
    if (px[p * 4] !== r || px[p * 4 + 1] !== g || px[p * 4 + 2] !== b || px[p * 4 + 3] !== 255) {
      throw new Error(
        `smoke: ${label} pixel ${p} is ${px[p * 4]},${px[p * 4 + 1]},${px[p * 4 + 2]},${px[p * 4 + 3]}`,
      );
    }
  }
}

// 1) per-frame palettes, loop forever
{
  const gif = dusrel_gif_encode(W, H, frames, delays, 0, 3, false);
  const header = String.fromCharCode(...gif.slice(0, 6));
  if (header !== "GIF89a") throw new Error(`smoke: bad header ${header}`);
  const d = decodeAll(gif);
  if (d.w !== W || d.h !== H || d.count !== 2) throw new Error("smoke: dims/count wrong");
  if (d.repeat !== 0) throw new Error(`smoke: repeat ${d.repeat}, want 0 (forever)`);
  if (d.frames[0].delay !== 10 || d.frames[1].delay !== 20) {
    throw new Error(`smoke: delays ${d.frames[0].delay}/${d.frames[1].delay}, want 10/20`);
  }
  expectPx(d.frames[0].px, 255, 0, 0, "frame 0");
  expectPx(d.frames[1].px, 0, 255, 0, "frame 1");
  console.log(`smoke OK: 2-frame GIF ${gif.length} bytes, delays + repeat + pixels exact`);
}

// 2) global palette: frame 1 must be nearest-mapped onto frame 0's
// palette and still decode to pure green.
{
  const gif = dusrel_gif_encode(W, H, frames, delays, 0, 3, true);
  const d = decodeAll(gif);
  expectPx(d.frames[0].px, 255, 0, 0, "global frame 0");
  expectPx(d.frames[1].px, 0, 255, 0, "global frame 1");
  console.log(`smoke OK: global-palette GIF ${gif.length} bytes, pixels exact`);
}

// 3) no loop block: repeat reports -1 (play once)
{
  const one = new Uint8Array([...solid(0, 0, 255)]);
  const gif = dusrel_gif_encode(W, H, one, new Uint8Array([5, 0]), -1, 3, false);
  const d = decodeAll(gif);
  if (d.repeat !== -1) throw new Error(`smoke: repeat ${d.repeat}, want -1 (no block)`);
  expectPx(d.frames[0].px, 0, 0, 255, "single frame");
  console.log("smoke OK: single-frame GIF, repeat = play once");
}
