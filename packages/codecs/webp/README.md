# @dusrel/image-webp

libwebp codec (WASM, lazy-loaded, SIMD when available). Lossy/lossless, quality, effort 0-6, alpha quality, near-lossless. Vite users: exclude this package from optimizeDeps.

> Status: Phase 2 implemented — real libwebp WASM artifacts
> (encoder 271,456 B, decoder 129,271 B; non-SIMD, single-threaded)
> built by the `wasm-build` workflow from `native/webp`
> (webmproject/libwebp v1.6.0, emsdk 3.1.66), verified in the
> browser matrix including a pixel-exact lossless roundtrip.
