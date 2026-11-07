// Build-time smoke test (Node, inside the Docker build): PNG is
// lossless, so the roundtrip must be PIXEL-EXACT. Fails the build
// if the modules are hollow or broken.
import { readFile } from "node:fs/promises";

async function load(kind) {
  const mod = await import(`./out/png_${kind}.mjs`);
  const wasmBytes = await readFile(new URL(`./out/png_${kind}.wasm`, import.meta.url));
  await mod.default(wasmBytes);
  return mod;
}

const enc = await load("enc");
const dec = await load("dec");
const W = 4;
const H = 4;
const rgba = new Uint8Array(W * H * 4);
for (let p = 0; p < W * H; p++) {
  rgba[p * 4] = (p * 37) % 256;
  rgba[p * 4 + 1] = (p * 91) % 256;
  rgba[p * 4 + 2] = (p * 53) % 256;
  rgba[p * 4 + 3] = 255;
}
const pngBytes = enc.dusrel_png_encode(rgba, W, H, 1, 5, false);
const sig = Array.from(pngBytes.slice(0, 4));
if (sig.join(",") !== "137,80,78,71") throw new Error(`smoke: bad PNG signature ${sig}`);
const out = dec.dusrel_png_decode(pngBytes);
const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
if (view.getUint32(0, true) !== W || view.getUint32(4, true) !== H) {
  throw new Error("smoke: decoded dimensions wrong");
}
for (let i = 0; i < rgba.length; i++) {
  if (out[8 + i] !== rgba[i]) throw new Error(`smoke: pixel mismatch at ${i}`);
}
console.log(`smoke OK: png ${pngBytes.length} bytes, ${W}x${H} pixel-exact roundtrip`);
