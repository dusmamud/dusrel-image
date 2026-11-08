// Build-time smoke test, run inside the Docker build with Node.
// Fails the build if the linked module cannot really decode —
// a hollow module (e.g. the libde265 plugin silently missing
// from the link) would still compile, but decoding the real
// fixture would fail here. The fixture is libheif v1.23.7's own
// examples/example.heic, copied into out/ by the Dockerfile.
import { readFile } from "node:fs/promises";

const mod = await import("./out/heic_dec.mjs");
const wasmBytes = await readFile(new URL("./out/heic_dec.wasm", import.meta.url));
const instance = await mod.default({ wasmBinary: wasmBytes });
const decodeFn = instance.cwrap("dusrel_heic_decode", "number", [
  "number",
  "number",
  "number",
  "number",
]);

const fixture = await readFile(new URL("./out/fixture.heic", import.meta.url));
console.log(`fixture: ${fixture.length} bytes`);

function decode(bytes) {
  const inPtr = instance._malloc(bytes.length);
  instance.HEAPU8.set(bytes, inPtr);
  const wPtr = instance._malloc(4);
  const hPtr = instance._malloc(4);
  const outPtr = decodeFn(inPtr, bytes.length, wPtr, hPtr);
  const step = instance._dusrel_heic_last_step();
  if (!outPtr) {
    instance._free(inPtr);
    instance._free(wPtr);
    instance._free(hPtr);
    return { ok: false, step };
  }
  const w = instance.HEAPU32[wPtr >> 2];
  const h = instance.HEAPU32[hPtr >> 2];
  const pixels = instance.HEAPU8.slice(outPtr, outPtr + w * h * 4);
  instance._free(inPtr);
  instance._free(wPtr);
  instance._free(hPtr);
  instance._free(outPtr);
  return { ok: true, step, w, h, pixels };
}

// 1) The real fixture must decode to a real photo-sized image.
const out = decode(fixture);
if (!out.ok) throw new Error(`smoke: fixture decode failed at glue step ${out.step}`);
if (out.w < 100 || out.h < 100) throw new Error(`smoke: implausible dims ${out.w}x${out.h}`);
const mean = [0, 0, 0, 0];
for (let i = 0; i < out.pixels.length; i += 4) {
  mean[0] += out.pixels[i];
  mean[1] += out.pixels[i + 1];
  mean[2] += out.pixels[i + 2];
  mean[3] += out.pixels[i + 3];
}
const n = out.w * out.h;
console.log(
  `smoke OK: decoded ${out.w}x${out.h}, mean rgba = [${mean.map((v) => Math.round(v / n)).join(", ")}], ` +
    `corner = [${Array.from(out.pixels.slice(0, 4)).join(", ")}], ` +
    `centre = [${Array.from(out.pixels.slice((Math.floor(out.h / 2) * out.w + Math.floor(out.w / 2)) * 4, (Math.floor(out.h / 2) * out.w + Math.floor(out.w / 2)) * 4 + 4)).join(", ")}]`,
);
if (mean[3] / n < 250) throw new Error("smoke: alpha channel implausible for a photo");

// 2) Garbage and truncated inputs must fail cleanly (NULL +
// a recorded step), never crash or return a bogus buffer.
const garbage = decode(new Uint8Array(256));
if (garbage.ok) throw new Error("smoke: garbage input decoded?!");
const truncated = decode(fixture.subarray(0, 128));
if (truncated.ok) throw new Error("smoke: truncated input decoded?!");
console.log(
  `smoke OK: garbage rejected (step ${garbage.step}), truncated rejected (step ${truncated.step})`,
);
