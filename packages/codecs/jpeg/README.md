# @dusrel/image-jpeg

MozJPEG codec (WASM, lazy-loaded). Separate encode/decode entries. Controls: quality, progressive, chroma subsampling, alpha flatten background. Vite users: exclude this package from optimizeDeps.

> Status: Phase 2 implemented — real MozJPEG WASM artifacts (encoder
> 420,092 B, decoder 171,070 B; non-SIMD, single-threaded) built by
> the `wasm-build` workflow from `native/mozjpeg` (mozilla/mozjpeg
> v4.1.5, emsdk 3.1.66) and verified in the browser matrix. The
> encoder is larger than the ~246 KB reference figure in
> docs/CODEC_GUIDE.md (jSquash ships size-tuned builds); squeezing
> it (-Os, feature trimming) is tracked as optimisation work, not a
> blocker.
