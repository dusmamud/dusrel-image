// Functional smoke gate for the oxipng module (runs INSIDE the
// Docker build; a hollow module must fail here, not in production).
// Builds a deliberately fat PNG by hand (stored DEFLATE, no filters,
// plus a strippable tEXt chunk), optimises it, and verifies: valid
// PNG signature, strictly smaller, tEXt gone, and — after unfiltering
// the IDAT — pixel-exact against the known source.
import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const glue = await import("./out/oxipng.mjs");
await glue.default({ module_or_path: readFileSync("./out/oxipng.wasm") });
if (typeof glue.dusrel_oxipng_optimize !== "function") {
  console.error("SMOKE FAIL: dusrel_oxipng_optimize missing");
  process.exit(1);
}

// --- tiny PNG writer (CRC32 + stored zlib) ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
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
    rgba[i + 3] = 255 - (x % 4) * 30; // varying alpha keeps RGBA colour type
  }
}
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0; // filter: none
  Buffer.from(rgba.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type RGBA
const fat = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("tEXt", Buffer.from("Comment\0dusrel smoke filler dusrel smoke filler")),
  chunk("IDAT", deflateSync(raw, { level: 0 })),
  chunk("IEND", Buffer.alloc(0)),
]);

// --- optimise: level 2, strip all, keep interlace, not forced ---
const out = Buffer.from(glue.dusrel_oxipng_optimize(new Uint8Array(fat), 2, 2, -1, false));
const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
if (!sig.every((b, i) => out[i] === b)) {
  console.error("SMOKE FAIL: output is not a PNG");
  process.exit(1);
}
if (out.length >= fat.length) {
  console.error(`SMOKE FAIL: no size win (${fat.length} -> ${out.length})`);
  process.exit(1);
}
if (out.includes(Buffer.from("tEXt"))) {
  console.error("SMOKE FAIL: tEXt chunk survived strip=all");
  process.exit(1);
}

// --- pixel check: inflate IDAT, unfilter, compare ---
let pos = 8;
let idat = Buffer.alloc(0);
let width = 0;
let height = 0;
while (pos < out.length) {
  const len = out.readUInt32BE(pos);
  const type = out.toString("ascii", pos + 4, pos + 8);
  const data = out.subarray(pos + 8, pos + 8 + len);
  if (type === "IHDR") {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
  }
  if (type === "IDAT") idat = Buffer.concat([idat, data]);
  pos += 12 + len;
}
if (width !== W || height !== H) {
  console.error(`SMOKE FAIL: dims changed ${width}x${height}`);
  process.exit(1);
}
const inflated = inflateSync(idat);
const stride = W * 4;
const pixels = Buffer.alloc(H * stride);
for (let y = 0; y < H; y++) {
  const f = inflated[y * (1 + stride)];
  const row = inflated.subarray(y * (1 + stride) + 1, (y + 1) * (1 + stride));
  const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
  const cur = pixels.subarray(y * stride, (y + 1) * stride);
  for (let i = 0; i < stride; i++) {
    const a = i >= 4 ? cur[i - 4] : 0;
    const b = prev[i];
    const c = i >= 4 ? prev[i - 4] : 0;
    let v = row[i];
    if (f === 1) v = (v + a) & 0xff;
    else if (f === 2) v = (v + b) & 0xff;
    else if (f === 3) v = (v + ((a + b) >> 1)) & 0xff;
    else if (f === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
    }
    cur[i] = v;
  }
}
let exact = pixels.length === rgba.length;
for (let i = 0; exact && i < rgba.length; i++) exact = pixels[i] === rgba[i];
if (!exact) {
  console.error("SMOKE FAIL: pixels changed — optimisation must be lossless");
  process.exit(1);
}
console.log(`SMOKE OK: oxipng ${fat.length} -> ${out.length} bytes, tEXt stripped, pixels exact`);
