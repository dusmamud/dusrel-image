# Codec Guide: dusrel-image

Per-codec options, defaults and traps. All codecs are separate sub-packages
with lazy-loaded WASM (see TRD.md). Sizes below are the upstream WASM
binaries' approximate sizes at research time (Nov 2026) and must be
re-measured at build time.

## JPEG — `@dusrel/image-jpeg` (MozJPEG, ~246 KB WASM)
- Controls: quality (0..100 mapped from the API's 0..1), progressive on/off,
  chroma subsampling (4:4:4 / 4:2:2 / 4:2:0), optimised Huffman tables.
- Trap: JPEG has no alpha. Transparent pixels are flattened onto a
  configurable background colour (default white) — always, and documented in
  the result report.
- Expectation: ~53% median saving at quality 0.75 on photographic content.

## WebP — `@dusrel/image-webp` (libwebp, ~275-337 KB WASM, SIMD when available)
- Controls: lossy/lossless, quality, effort/method 0..6, alpha quality,
  near-lossless.
- Note: re-encoding an already-optimised WebP gains little (~17% in
  benchmarks). Do not pre-quantise before WebP — it makes results worse.

## AVIF — `@dusrel/image-avif` (libavif + libaom, ~2.8-3.3 MB WASM)
- Controls: quality, alpha quality, speed 0..10, lossless, chroma.
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
- `@dusrel/image-jxl` (libjxl): excellent compression, but browser decode
  support is still limited — ship behind an "experimental" label.
- `@dusrel/image-qoi`: niche, near-zero cost, optional.
- GIF (`@dusrel/image-gif`) and SVG (`@dusrel/image-svg`): optimisers, not
  pixel codecs. GIF engine decided 2026-11-07: a permissive Rust `gif`-crate
  based optimiser/encoder; gifsicle was dropped on licence grounds
  (GPL-2.0-only) so the package stays MIT (THIRD_PARTY_LICENSES.md).
