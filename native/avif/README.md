# native/avif

Reproducible WASM build of libavif + libaom for `@dusrel/image-avif`.

- Upstream: libaom **v3.12.1** (generic CPU target, encode + decode,
  installed into a local prefix) and libavif **v1.4.2** with only the
  AOM codec enabled, inside the pinned `emscripten/emsdk:3.1.66`
  image (see `Dockerfile`).
- Glue in `wrapper/` is our own code against the public libavif API
  (RGBA in/out via `avifRGBImage`; quality / qualityAlpha / speed /
  pixel format on encode). Single-threaded by design — threaded AVIF
  would need cross-origin isolation (see docs/CODEC_GUIDE.md).
- The AOM build is large; CI gives this job an extended timeout.
- CI builds this in the `wasm-build` workflow (`avif-wasm` artifact);
  verified artifacts are committed into `packages/codecs/avif/codec/`.
