# @dusrel/image-resize

High-quality image resampling for the @dusrel/image family, powered
by the Rust [`resize`](https://crates.io/crates/resize) crate
compiled to WebAssembly — the same engine family Squoosh and
jSquash use. The Canvas fast path in `@dusrel/image-core` stays the
default; this package is the quality path you opt into when pixels
matter (thumbnails, avatars, print exports).

```bash
npm install @dusrel/image-resize
```

```ts
import { resize } from '@dusrel/image-resize';

const thumb = await resize(imageData, { width: 320, height: 240, filter: 'lanczos3' });
```

## API

| Export | What it does |
| --- | --- |
| `resize(ImageData, options)` | Resample to `width`×`height`, returns a new `ImageData` |
| `init()` | Preload the WASM module |
| `setCodecAssets({...})` | Override asset URLs (CDN hosting, tests) |
| `resolveOptions(options)` | The validated options with defaults applied |

## Options

| Option | Values | Default |
| --- | --- | --- |
| `width` / `height` | positive integers | *(required)* |
| `filter` | `'nearest' \| 'triangle' \| 'catmull-rom' \| 'mitchell' \| 'bspline' \| 'gaussian' \| 'lanczos3'` | `'lanczos3'` |
| `alpha` | `'premultiplied' \| 'straight'` | `'premultiplied'` |

## Alpha, handled correctly

`ImageData` stores **straight** (unpremultiplied) alpha. Resampling
straight-alpha pixels directly lets the RGB of fully transparent
pixels bleed into visible edges (a red photo edge next to
transparent-green padding turns muddy). With the default
`alpha: 'premultiplied'` the module premultiplies, resamples via
the crate's premultiplied format, then unpremultiplies — verified
in tests: the boundary stays pure red as it fades. Use
`alpha: 'straight'` only for non-colour data (masks, depth maps).

## Honest scope

- **hqx is not included.** The `resize` crate has no hqx
  implementation; it is tracked as future work in
  docs/CODEC_GUIDE.md rather than promised here. For pixel art,
  `'nearest'` is the correct v1 choice.
- Module size as committed: `codec/resize.wasm` **161,317 B**.

## Provenance

Built reproducibly from `native/rust` (pinned `rust:1.99.1` +
wasm-bindgen 0.2.130, `resize = 0.8.9`) by the repo's `wasm-build`
workflow; the Docker build ends with a functional smoke gate
(exact nearest blocks, stable lanczos solid). Verified again in
Chromium, Firefox and WebKit by `tests/browser/resize.spec.ts`.

Licences: this package MIT; resize and rgb crates MIT (see the
repo's THIRD_PARTY_LICENSES.md).
