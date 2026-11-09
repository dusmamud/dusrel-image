# Codec Guide: dusrel-image

Per-codec options, defaults and traps. All codecs are separate sub-packages
with lazy-loaded WASM (see TRD.md). Sizes below are the shipped artifacts,
measured from the published 1.0.0 packages (encoder / decoder WASM).

## Codec assets and bundlers

Every codec package resolves its `.wasm`/glue `.js` with
`new URL('../codec/<file>', import.meta.url)` and lets callers
override any of the four URLs via `setCodecAssets`. Production
bundlers (Vite/Rollup, webpack) fingerprint and emit those files
automatically. Dev servers that *pre-bundle* dependencies into a
different directory (Vite's `optimizeDeps`) relocate the code and
break the relative resolution — the fetch returns HTML instead of
WASM. Fixes, verified against the published packages in a fresh
React + Vite consumer project: exclude the codec packages from
`optimizeDeps`, or pass `?url` imports to `setCodecAssets`. The
Quickstart's "WASM codecs with Vite" section has both recipes.

## JPEG — `@dusrel/image-jpeg` (MozJPEG — enc 420 KB, dec 171 KB WASM)
- Controls: quality 1..100 (default 75), progressive on/off (default on),
  chroma subsampling (4:4:4 / 4:2:2 / 4:2:0), optimised Huffman tables.
- Trap: JPEG has no alpha. Transparent pixels are flattened onto a
  configurable background colour (default white) — always, and documented in
  the result report.
- Expectation: ~53% median saving at quality 0.75 on photographic content.

## WebP — `@dusrel/image-webp` (libwebp — enc 271 KB, dec 129 KB WASM)
- Controls: lossy/lossless, quality, effort/method 0..6, alpha quality,
  near-lossless.
- Note: re-encoding an already-optimised WebP gains little (~17% in
  benchmarks). Do not pre-quantise before WebP — it makes results worse.

## AVIF — `@dusrel/image-avif` (libavif + libaom — enc 3.56 MB, dec 3.64 MB WASM)
- Controls: quality 0..100 (default 50), alpha quality, speed 0..10
  (default 9), pixel format (4:2:0 / 4:4:4 / 4:2:2).
- **Default speed is 9.** Measured upstream: a 12 MP photo at speed 7 took
  ~140 s single-threaded; speed 9 took ~40 s. Lower speeds are an explicit
  developer choice.
- Multi-threaded encoder exists but requires cross-origin isolation
  (COOP/COEP + SharedArrayBuffer): opt-in only, never default.
- Expectation: best size/quality (~59% median saving at q75) at the highest
  CPU cost. Always pair with progress + cancellation.

## PNG — `@dusrel/image-png` + `@dusrel/image-oxipng`
- PNG encode/decode via the Rust PNG crate; lossless optimisation via
  OxiPNG (levels 0..6, metadata strip, interlace control).
- Canvas `quality` does not apply to PNG; lossless PNG of photos stays large —
  guide users to quantize or WebP/AVIF.

## Quantize — `@dusrel/image-quantize` (permissive Rust quantizer, WASM)
- Lossy PNG by palette reduction: max colours 2..256, dithering level.
- Expectation: ~75% median saving on PNG at q75 settings. Use only for PNG
  output (see WebP note above).
- Engine decided 2026-11-07: a permissive Rust quantizer. libimagequant was
  dropped on licence grounds (GPL-3.0-or-later) so this package stays MIT
  (see THIRD_PARTY_LICENSES.md).

## Resize — `@dusrel/image-resize` (Rust resize crate)
- Algorithms: Lanczos3 (default for downscale), Mitchell, Catmull-Rom,
  Triangle, Nearest (pixel art), B-spline, Gaussian.
- Status note (2026-11-07): hqx (pixel-art upscaler) was listed here
  from the jSquash survey, but the `resize` crate does not contain
  an hqx implementation. Rather than promise it silently, hqx is
  tracked as future work (a dedicated permissive implementation);
  the seven filters above are what v1 ships.
- Handles premultiplied alpha correctly; the Canvas fast path remains the
  default when the developer does not select this package.

## Experimental / optional
- `@dusrel/image-jxl` (libjxl — enc 2.40 MB, dec 905 KB WASM): excellent
  compression, but browser decode support is still limited — ship behind
  an "experimental" label.
- `@dusrel/image-qoi` (enc 34 KB, dec 36 KB WASM): niche, near-zero cost,
  optional.
- `@dusrel/image-heic` (decoder 1.20 MB WASM): **decode-only**, native-first
  — Safari 17+ decodes HEIC itself, other browsers fall back to the WASM
  engine (libheif + libde265, LGPL-3.0, fenced to this package per
  ADR-0008; the wrapper is MIT). No encoder: the only HEVC encoders are
  GPL (x265) or patent-encumbered.
- GIF (`@dusrel/image-gif`, 128 KB WASM) and SVG (`@dusrel/image-svg`):
  optimisers, not pixel codecs. GIF engine decided 2026-11-07: a
  permissive Rust `gif`-crate based optimiser/encoder; gifsicle was
  dropped on licence grounds (GPL-2.0-only) so the package stays MIT
  (THIRD_PARTY_LICENSES.md).
