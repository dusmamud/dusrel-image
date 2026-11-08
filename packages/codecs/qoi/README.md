# @dusrel/image-qoi

QOI ("Quite OK Image") codec for the browser — the Rust `qoi`
crate compiled to WASM (separate lazy-loaded encode/decode
modules, **34 KB / 36 KB**).

```bash
npm install @dusrel/image-qoi
```

```ts
import { encode, decode } from '@dusrel/image-qoi';

const bytes = await encode(imageData);          // Uint8Array, 'qoif' magic
const back = await decode(bytes);               // ImageData, RGBA8
```

## What QOI is (and is not)

QOI is a lossless format designed for speed and simplicity:
one pass, no entropy coding heroics, and compression that
beats PNG on many photographic images while encoding several
times faster. It has **no quality knobs** — this package's
`encode()` takes just the pixels. Files are written with
4 channels and the sRGB colorspace tag (the tag is informative
only; it never changes pixels).

The decoder accepts both RGBA and RGB files; RGB sources are
expanded to RGBA with alpha 255, the family decode convention.

Browsers cannot display QOI natively — this package is for
pipelines that control both ends (asset pipelines, games,
internal tools, canvas round-trips), which is exactly why it
lives in an optional sub-package instead of the core.

## Engines & licences

- Codec: the Rust [`qoi`](https://crates.io/crates/qoi) crate
  (aldanor/qoi-rust), MIT OR Apache-2.0.
- The QOI format specification itself is public domain
  (Dominic Szablewski).
- Glue and wrapper: MIT (this package). Built reproducibly
  from `native/rust` by the repo's wasm-build workflow, with a
  functional smoke gate inside the Docker build and the
  artifacts re-verified in Node before being committed.

## Status

Implemented (Phase 5, experimental tier). Proven in the
Playwright suite — magic/header bytes, pixel-exact roundtrip
with varying alpha, and RGB-file expansion — in Chromium,
Firefox and WebKit.
