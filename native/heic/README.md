# native/heic — libheif WASM build for @dusrel/image-heic

Decode-only WebAssembly build of **libheif v1.23.7** +
**libde265 1.0.15** (both LGPL-3.0; see ADR-0008 for the
licence decision — Option A, accepted by Dus on 2026-11-08).

- `Dockerfile` — pinned emsdk 3.1.66 build following upstream
  libheif's `build-emscripten.sh` recipe (autotools libde265,
  CMake libheif with multithreading and plugin loading off),
  linking our own glue instead of upstream's Embind module.
- `wrapper/heif_dec.cpp` — minimal C-API glue:
  `dusrel_heic_decode` decodes the primary image via
  `heif_decode_image` (container transformations applied, so
  pixels are upright) to interleaved RGBA, with a step counter
  for diagnosable failures.
- `smoke.mjs` — in-Docker functional gate: decodes libheif's
  own `examples/example.heic` (also exported as the wrapper's
  test fixture) and rejects garbage/truncated inputs.

Artifacts: `heic_dec.js`, `heic_dec.wasm`, `fixture.heic`,
built by the `libheif` job in `.github/workflows/wasm-build.yml`.
