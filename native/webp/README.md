# native/webp

Reproducible WASM build of libwebp for `@dusrel/image-webp`.

- Upstream: webmproject/libwebp **v1.6.0**, static library inside the
  pinned `emscripten/emsdk:3.1.66` image (see `Dockerfile`).
- Glue in `wrapper/` is our own code against the public libwebp API:
  the encoder uses the advanced `WebPConfig`/`WebPPicture` API
  (quality, lossless, effort/method, alpha quality); the decoder uses
  `WebPDecodeRGBA`. Both expose the same malloc-buffer contract as the
  MozJPEG glue.
- CI builds this in the `wasm-build` workflow (`webp-wasm` artifact);
  verified artifacts are committed into `packages/codecs/webp/codec/`.
