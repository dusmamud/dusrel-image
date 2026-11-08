// Build-time smoke test, run inside the Docker build with Node.
// Fails the build if the linked modules cannot really
// encode/decode (guards against hollow modules — e.g. a codec
// silently disabled at configure time would still link, but
// encode would return null).
import { readFile } from "node:fs/promises";

async function load(kind, fnName, sig, ret = "number") {
  const mod = await import(`./out/jxl_${kind}.mjs`);
  const wasmBytes = await readFile(new URL(`./out/jxl_${kind}.wasm`, import.meta.url));
  const instance = await mod.default({ wasmBinary: wasmBytes });
  return { instance, fn: instance.cwrap(fnName, ret, sig) };
}

const { instance: enc, fn: encFn } = await load("enc", "dusrel_jxl_encode", [
  "number", "number", "number", "number", "number", "number", "number",
]);
const { instance: dec, fn: decFn } = await load("dec", "dusrel_jxl_decode", [
  "number", "number", "number", "number",
]);

const W = 16;
const H = 16;
const rgba = new Uint8Array(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    rgba[i] = Math.round((x / (W - 1)) * 255);
    rgba[i + 1] = Math.round((y / (H - 1)) * 255);
    rgba[i + 2] = 128;
    rgba[i + 3] = 255;
  }
}

function encode(pixels, quality, effort, lossless) {
  const inPtr = enc._malloc(pixels.length);
  enc.HEAPU8.set(pixels, inPtr);
  const sizePtr = enc._malloc(4);
  const outPtr = encFn(inPtr, W, H, quality, effort, lossless, sizePtr);
  if (!outPtr) throw new Error("smoke: encode returned null");
  const size = enc.HEAPU32[sizePtr >> 2];
  const bytes = enc.HEAPU8.slice(outPtr, outPtr + size);
  enc._free(inPtr);
  enc._free(sizePtr);
  enc._free(outPtr);
  return bytes;
}

function decode(bytes) {
  const inPtr = dec._malloc(bytes.length);
  dec.HEAPU8.set(bytes, inPtr);
  const wPtr = dec._malloc(4);
  const hPtr = dec._malloc(4);
  const outPtr = decFn(inPtr, bytes.length, wPtr, hPtr);
  if (!outPtr) throw new Error("smoke: decode returned null");
  const w = dec.HEAPU32[wPtr >> 2];
  const h = dec.HEAPU32[hPtr >> 2];
  const pixels = dec.HEAPU8.slice(outPtr, outPtr + w * h * 4);
  dec._free(inPtr);
  dec._free(wPtr);
  dec._free(hPtr);
  dec._free(outPtr);
  return { w, h, pixels };
}

// 1) Lossless roundtrip must be PIXEL-EXACT.
const losslessBytes = encode(rgba, 100, 3, 1);
if (!(losslessBytes[0] === 0xff && losslessBytes[1] === 0x0a)) {
  throw new Error(
    `smoke: bad codestream signature ${losslessBytes[0]},${losslessBytes[1]}`,
  );
}
const losslessOut = decode(losslessBytes);
if (losslessOut.w !== W || losslessOut.h !== H) throw new Error("smoke: dims wrong");
for (let i = 0; i < rgba.length; i++) {
  if (losslessOut.pixels[i] !== rgba[i]) {
    throw new Error(`smoke: lossless pixel mismatch at ${i}`);
  }
}
console.log(`smoke OK: lossless ${losslessBytes.length} bytes, pixel-exact`);

// 2) Lossy roundtrip at quality 90 must be CLOSE (smooth
// gradient, so a generous per-channel tolerance still proves
// real encoding rather than noise).
const lossyBytes = encode(rgba, 90, 3, 0);
const lossyOut = decode(lossyBytes);
let maxDelta = 0;
for (let i = 0; i < rgba.length; i++) {
  maxDelta = Math.max(maxDelta, Math.abs(lossyOut.pixels[i] - rgba[i]));
}
if (maxDelta > 16) throw new Error(`smoke: lossy max delta ${maxDelta} > 16`);
console.log(`smoke OK: lossy q90 ${lossyBytes.length} bytes, max delta ${maxDelta}`);
