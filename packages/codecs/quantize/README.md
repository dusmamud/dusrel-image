# @dusrel/image-quantize

Colour quantization for the @dusrel/image family, powered by the
Rust [`quantizr`](https://crates.io/crates/quantizr) crate compiled
to WebAssembly. Reduce an image to a palette of at most 256
colours plus one index per pixel — the preparation step behind
small PNGs (pair it with `@dusrel/image-png`, and let
`@dusrel/image-oxipng`'s palette reduction finish the job).

```bash
npm install @dusrel/image-quantize
```

```ts
import { quantize, quantizeToImageData } from '@dusrel/image-quantize';

const { palette, indices, colorCount, error } = await quantize(imageData, {
  maxColors: 256,
  dithering: 1,
});
const ready = await quantizeToImageData(imageData); // expanded RGBA
```

## API

| Export | What it does |
| --- | --- |
| `quantize(ImageData, options?)` | → `QuantizeResult` (palette, indices, colorCount, error) |
| `quantizeToImageData(ImageData, options?)` | Quantize + expand back to RGBA `ImageData` |
| `resultToImageData(result)` | Expand a `QuantizeResult` (pure, no WASM) |
| `init()` | Preload the WASM module |
| `setCodecAssets({...})` | Override asset URLs (CDN hosting, tests) |
| `resolveOptions(options?)` | The validated options with defaults applied |

## Options

| Option | Values | Default | Notes |
| --- | --- | --- | --- |
| `maxColors` | `2..256` | `256` | Palette size cap |
| `dithering` | `0..1` | `1` | 0 = banded but exact palette colours; 1 = full error diffusion |

## Why quantizr (a licence decision, on record)

This package was originally planned around libimagequant — until
its licence was verified as GPL-3.0-or-later for FLOSS use with a
commercial licence required otherwise. Dus's call (2026-11-07):
swap the engine, keep everything MIT. quantizr is the permissive
MIT quantizer that replaced it (docs/adr/0003 addendum,
THIRD_PARTY_LICENSES.md). Measured locally on a noisy 128×128
photo-like gradient: PNG 41,601 → 27,897 bytes (−33%) after
quantizing to 256 colours; flat-colour content saves far more.

Module size as committed: `codec/quantize.wasm` **59,728 B** —
the family's smallest WASM.

## Provenance

Built reproducibly from `native/rust` (pinned `rust:1.99.1` +
wasm-bindgen 0.2.130, `quantizr = 1.4.3`) by the repo's
`wasm-build` workflow; the Docker build ends with a functional
smoke gate (bounded palette/indices, finite error, bounded
remap distance). Verified again in Chromium, Firefox and WebKit
by `tests/browser/quantize.spec.ts`.

Licences: this package MIT; quantizr MIT.
