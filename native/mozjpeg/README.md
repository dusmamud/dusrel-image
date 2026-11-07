# native/mozjpeg

Reproducible WASM build of the MozJPEG codec for `@dusrel/image-jpeg`.

- Upstream: mozilla/mozjpeg **v4.1.5**, built as a static library inside
  the pinned `emscripten/emsdk:3.1.66` image (see `Dockerfile`).
- The encoder/decoder glue in `wrapper/` is our own code written against
  the public libjpeg API (`dusrel_jpeg_encode` / `dusrel_jpeg_decode`,
  RGBA in/out).
- Non-SIMD, single-threaded artifacts are the default (docs/WASM_BUILD.md).
- Build locally (Docker required): `docker build -t dusrel/mozjpeg .`
  then `docker run --rm -v "$PWD/out:/out" dusrel/mozjpeg`.
- CI builds the same image in the `wasm-build` workflow and uploads the
  artifacts; verified artifacts are then committed into
  `packages/codecs/jpeg/codec/`.
