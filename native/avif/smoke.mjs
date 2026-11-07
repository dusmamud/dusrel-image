// Build-time smoke test, run inside the Docker build with Node.
// Fails the build if the linked modules cannot really encode/decode
// (guards against hollow modules — e.g. a codec silently disabled
// at configure time would still link, but encode would return null).
import { readFile } from 'node:fs/promises';

async function load(kind, fnName, sig) {
  const mod = await import(`./out/avif_${kind}.js`);
  const wasmBytes = await readFile(new URL(`./out/avif_${kind}.wasm`, import.meta.url));
  const instance = await mod.default({ wasmBinary: wasmBytes });
  return { instance, fn: instance.cwrap(fnName, 'number', sig) };
}

const { instance: enc, fn: encFn } = await load('enc', 'dusrel_avif_encode', [
  'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number',
]);
const W = 8;
const H = 8;
const rgba = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) {
  rgba[i * 4] = 200;
  rgba[i * 4 + 1] = 30;
  rgba[i * 4 + 2] = 40;
  rgba[i * 4 + 3] = 255;
}
const inPtr = enc._malloc(rgba.length);
const sizePtr = enc._malloc(4);
enc.HEAPU8.set(rgba, inPtr);
const outPtr = encFn(inPtr, W, H, 90, 90, 10, 1, sizePtr);
if (outPtr === 0) throw new Error('smoke: encode returned null (codec missing?)');
const size = enc.HEAPU32[sizePtr >> 2];
const bytes = enc.HEAPU8.slice(outPtr, outPtr + size);
const brand = new TextDecoder().decode(bytes.slice(4, 12));
if (!brand.startsWith('ftyp') || !brand.includes('avif')) {
  throw new Error(`smoke: bad AVIF brand: ${JSON.stringify(brand)}`);
}

const { instance: dec, fn: decFn } = await load('dec', 'dusrel_avif_decode', [
  'number', 'number', 'number', 'number',
]);
const dIn = dec._malloc(bytes.length);
const wPtr = dec._malloc(4);
const hPtr = dec._malloc(4);
dec.HEAPU8.set(bytes, dIn);
const px = decFn(dIn, bytes.length, wPtr, hPtr);
if (px === 0) throw new Error('smoke: decode returned null');
const w = dec.HEAPU32[wPtr >> 2];
const h = dec.HEAPU32[hPtr >> 2];
if (w !== W || h !== H) throw new Error(`smoke: decoded dims ${w}x${h}, expected ${W}x${H}`);
const [r, g, b] = dec.HEAPU8.slice(px, px + 3);
if (Math.abs(r - 200) > 24 || Math.abs(g - 30) > 24 || Math.abs(b - 40) > 24) {
  throw new Error(`smoke: decoded pixel ${r},${g},${b} too far from 200,30,40`);
}
console.log(`smoke OK: encoded ${size} bytes, decoded ${w}x${h} pixel ${r},${g},${b}`);
