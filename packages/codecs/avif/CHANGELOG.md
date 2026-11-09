# @dusrel/image-avif

## 1.0.1

### Patch Changes

- f428447: Fix the codec function binding so `setCodecAssets` works after first
  use. The cwrap'd encode/decode functions were cached from the first
  WASM module instance while `setCodecAssets` cleared the loader cache,
  so calling it after a codec had already run paired the old instance's
  functions with the new module's memory and silently produced empty
  output. Functions are now rebound whenever the module instance
  changes. (Lockstep: all @dusrel packages move to 1.0.1 together.)

## 1.0.0

### Major Changes

- bbe7229: Initial public release — the complete @dusrel/image family at 1.0.0: a
  zero-dependency canvas core and fluent pipeline (@dusrel/image-core,
  @dusrel/image), lazy-loaded WASM codecs (MozJPEG, libwebp, libavif,
  Rust png/oxipng/resize/quantize/qoi, libjxl, animated GIF, and
  decode-only libheif HEIC), feature packages (crop component,
  transforms, adjustments, metadata/EXIF, watermark, batch, SVGO,
  ThumbHash/BlurHash placeholders) and React/Vue/Svelte wrappers.
  All processing is client-side; every package is independently
  installable and ships ESM only.
