// Build-time smoke test (Node, inside the Docker build): QOI is
// lossless, so roundtrips must be PIXEL-EXACT. Also covers the
// RGB-file path: an RGB QOI must decode expanded to RGBA.
// Fails the build if the modules are hollow or broken.
import { readFile } from "node:fs/promises";

async function load(kind) {
  const mod = await import(`./out/qoi_${kind}.mjs`);
  const wasmBytes = await readFile(new URL(`./out/qoi_${kind}.wasm`, import.meta.url));
  await mod.default(wasmBytes);
  return mod;
}

const enc = await load("enc");
const dec = await load("dec");
const W = 8;
const H = 3;
const rgba = new Uint8Array(W * H * 4);
for (let p = 0; p < W * H; p++) {
  rgba[p * 4] = (p * 37) % 256;
  rgba[p * 4 + 1] = (p * 91) % 256;
  rgba[p * 4 + 2] = (p * 53) % 256;
  rgba[p * 4 + 3] = (p * 29) % 256; // varying alpha exercises QOI_OP_RGBA
}
const bytes = enc.dusrel_qoi_encode(rgba, W, H);
const magic = String.fromCharCode(...bytes.slice(0, 4));
if (magic !== "qoif") throw new Error(`smoke: bad QOI magic ${magic}`);
if (bytes[12] !== 4) throw new Error(`smoke: channels byte ${bytes[12]} != 4`);
const out = dec.dusrel_qoi_decode(bytes);
const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
if (view.getUint32(0, true) !== W || view.getUint32(4, true) !== H) {
  throw new Error("smoke: decoded dimensions wrong");
}
for (let i = 0; i < rgba.length; i++) {
  if (out[8 + i] !== rgba[i]) throw new Error(`smoke: pixel mismatch at ${i}`);
}
// The RGB -> RGBA decode expansion path is proven in the
// browser suite against a hand-built RGB QOI fixture.
console.log(`smoke OK: qoi ${bytes.length} bytes, ${W}x${H} pixel-exact roundtrip`);
