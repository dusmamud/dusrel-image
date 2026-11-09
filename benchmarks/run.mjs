// dusrel-image benchmark — real timings for the shipped packages.
//
// Corpus: three deterministic synthetic images generated below from a
// seeded PRNG (photo-like gradient+noise, flat UI-like blocks, alpha
// pattern). They are licence-clean by construction — the generator IS
// the source. A real-photo corpus is future work; synthetic images do
// not flatter codecs the way flat test cards do because the photo
// image carries per-pixel noise, but treat absolute numbers as
// indicative, not marketing.
//
// Run:  pnpm build && node benchmarks/run.mjs
// Writes benchmarks/results.md and prints the same table.
//
// Node harness notes: the codec loaders fetch their WASM from file:
// URLs (Node's fetch refuses those), and Node has no ImageData
// global — the two shims below bridge exactly those gaps, the same
// pattern as the consumer pack-smoke. Package code is untouched.

import { readFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

globalThis.ImageData ??= class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height ?? data.length / 4 / width;
  }
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const href = String(url);
  if (href.startsWith("file:")) {
    const buf = await readFile(fileURLToPath(href));
    return new Response(buf, {
      headers: { "content-type": href.endsWith(".wasm") ? "application/wasm" : "text/javascript" },
    });
  }
  return realFetch(url, init);
};

const pkg = (p) => new URL(`../packages/${p}/dist/index.js`, import.meta.url).href;
const jpeg = await import(pkg("codecs/jpeg"));
const webp = await import(pkg("codecs/webp"));
const avif = await import(pkg("codecs/avif"));
const png = await import(pkg("codecs/png"));
const oxipng = await import(pkg("codecs/oxipng"));
const quantize = await import(pkg("codecs/quantize"));
const resize = await import(pkg("codecs/resize"));
const placeholder = await import(pkg("features/placeholder"));
const metadata = await import(pkg("features/metadata"));
const svg = await import(pkg("features/svg"));

// --- deterministic corpus -------------------------------------------
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function makeImage(width, height, fill) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b, a] = fill(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  return new ImageData(data, width, height);
}
const rand = rng(20261108);
const noise = new Float32Array(384 * 288);
for (let i = 0; i < noise.length; i++) noise[i] = (rand() - 0.5) * 36;
const photo = makeImage(384, 288, (x, y) => [
  128 + 90 * Math.sin(x / 47) + 30 * Math.cos(y / 23) + noise[y * 384 + x],
  110 + 70 * Math.sin((x + y) / 61) + noise[y * 384 + x] * 0.7,
  90 + 80 * Math.cos(x / 31 + y / 57) + noise[y * 384 + x] * 0.5,
  255,
]);
const ui = makeImage(800, 600, (x, y) => {
  const block = (Math.floor(x / 100) + Math.floor(y / 75)) % 5;
  const palette = [
    [238, 240, 244],
    [31, 41, 55],
    [59, 130, 246],
    [16, 185, 129],
    [245, 158, 11],
  ];
  const c = palette[block];
  return y % 24 < 2 ? [200, 204, 212, 255] : [c[0], c[1], c[2], 255];
});
const alphaImg = makeImage(256, 256, (x, y) => {
  const d = Math.hypot(x - 128, y - 128) / 128;
  return [220 * (1 - d), 80, 200 * d, Math.max(0, 255 * (1 - d))];
});

// --- timing ----------------------------------------------------------
const bytes = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x));
async function bench(name, input, inputBytes, fn, runs = 5) {
  await fn(); // warmup (also loads the WASM module)
  const times = [];
  let out;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    out = await fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const outBytes =
    out == null || typeof out === "number"
      ? null
      : out.data instanceof Uint8ClampedArray
        ? out.data.length // ImageData-like result (decode, resize)
        : bytes(out).length;
  rows.push({ name, input, inputBytes, outBytes, median });
  console.log(`${name.padEnd(38)} ${input.padEnd(14)} median ${median.toFixed(1)} ms`);
}

const rows = [];
const rawBytes = photo.width * photo.height * 4;
await bench("jpeg encode q80", "photo 384x288", rawBytes, async () =>
  jpeg.encode(photo, { quality: 80 }),
);
const jpegOut = bytes(await jpeg.encode(photo, { quality: 80 }));
await bench("jpeg decode", "photo 384x288", jpegOut.length, async () => jpeg.decode(jpegOut));
await bench("webp encode q80", "photo 384x288", rawBytes, async () =>
  webp.encode(photo, { quality: 80 }),
);
await bench("webp lossless encode", "ui 800x600", ui.width * ui.height * 4, async () =>
  webp.encode(ui, { lossless: true }),
);
await bench(
  "avif encode q50 speed 9",
  "photo 384x288",
  rawBytes,
  async () => avif.encode(photo, { quality: 50, speed: 9 }),
  3,
);
await bench("png encode", "photo 384x288", rawBytes, async () => png.encode(photo));
const pngOut = bytes(await png.encode(photo));
await bench("png decode", "photo 384x288", pngOut.length, async () => png.decode(pngOut));
await bench("oxipng optimize (level 2)", "photo png", pngOut.length, async () =>
  oxipng.optimize(pngOut),
);
await bench("quantize 256 colors", "photo 384x288", rawBytes, async () => {
  await quantize.quantize(photo, { maxColors: 256 });
  return null;
});
await bench("resize lanczos3 50%", "photo 384x288", rawBytes, async () =>
  resize.resize(photo, { width: 192, height: 144, filter: "lanczos3" }),
);
await bench("thumbhash encode", "photo 384x288", rawBytes, async () => {
  placeholder.encodeThumbHash(photo);
  return null;
});
await bench("blurhash encode 4x3", "photo 384x288", rawBytes, async () => {
  placeholder.encodeBlurHash(photo);
  return null;
});
await bench(
  "metadata read (jpeg exif scan)",
  "jpeg bytes",
  jpegOut.length,
  async () => {
    metadata.readMetadata(jpegOut);
    return null;
  },
  25,
);
const svgSample = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><!-- comment --><rect x="0" y="0" width="100" height="100" fill="#ff0000"/><circle cx="50" cy="50" r="30" fill="#0000ff"/></svg>`;
await bench(
  "svg optimize (svgo multipass)",
  "inline svg",
  svgSample.length,
  async () => new TextEncoder().encode(svg.optimizeSvg(svgSample)),
  9,
);

// --- report ----------------------------------------------------------
const now = new Date().toISOString().slice(0, 10);
const fmt = (n) => (n == null ? "—" : n.toLocaleString("en-US"));
const table = rows
  .map(
    (r) =>
      `| ${r.name} | ${r.input} | ${fmt(r.inputBytes)} | ${fmt(r.outBytes)} | ${r.median.toFixed(1)} |`,
  )
  .join("\n");
writeFileSync(
  new URL("./results.md", import.meta.url),
  `# Benchmark results

Generated by \`benchmarks/run.mjs\` on ${now} — Node ${process.version},
${process.platform}/${process.arch}. Corpus: deterministic synthetic
images generated in the script (photo-like gradient + noise, flat
UI-like blocks, alpha pattern); sizes are raw RGBA byte counts for
encode inputs. Times are medians (5 runs after 1 warmup; AVIF 3 runs,
metadata 25 runs). WASM codecs run single-threaded, as shipped.

| Operation | Input | In (bytes) | Out (bytes) | Median (ms) |
| --- | --- | ---: | ---: | ---: |
${table}
`,
);
console.log("\nwrote benchmarks/results.md");
