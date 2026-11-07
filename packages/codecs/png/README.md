# @dusrel/image-png

PNG codec for the @dusrel/image family, powered by the Rust
[`png`](https://crates.io/crates/png) crate compiled to WebAssembly.
Lossless by definition: the options trade CPU time and file size,
**never pixels** — every encode/decode roundtrip is pixel-exact.

```bash
npm install @dusrel/image-png
```

```ts
import { encode, decode } from '@dusrel/image-png';

const pngBytes = await encode(imageData, { compression: 'best' });
const pixels = await decode(pngBytes); // ImageData, always RGBA8
```

## API

| Export | What it does |
| --- | --- |
| `encode(ImageData, options?)` | RGBA pixels → PNG `ArrayBuffer` |
| `decode(bytes)` | PNG bytes → `ImageData` (palette/grey/RGB sources are converted to RGBA8) |
| `initEncode()` / `initDecode()` | Preload one direction's WASM module |
| `setCodecAssets({...})` | Override asset URLs (CDN hosting, tests) |
| `resolveEncodeOptions(options?)` | The validated options with defaults applied |

Encoder and decoder are **separate WASM modules**, each built from
the same Rust crate with a different cargo feature — importing the
package downloads nothing until first use, and an app that only
encodes never pays for the decoder.

## Encode options

| Option | Values | Default | Notes |
| --- | --- | --- | --- |
| `compression` | `'fast' \| 'default' \| 'best'` | `'default'` | Maps to the png crate's Fast/Balanced/High DEFLATE settings |
| `filter` | `'none' \| 'sub' \| 'up' \| 'avg' \| 'paeth' \| 'adaptive'` | `'adaptive'` | Per-row filter strategy |
| ~~`interlace`~~ | — | — | The png crate cannot encode Adam7; interlace control lives in `@dusrel/image-oxipng` |

## Module sizes (as committed)

| Module | Size |
| --- | --- |
| `codec/png_enc.wasm` | 115,510 B |
| `codec/png_dec.wasm` | 145,375 B |

## Provenance

Built reproducibly from `native/rust` (pinned `rust:1.99.1` +
wasm-bindgen 0.2.130, `png = 0.18.1`) by the repo's `wasm-build`
workflow; the Docker build ends with a functional smoke gate that
demands a pixel-exact roundtrip. The committed artifacts are also
verified in Chromium, Firefox and WebKit by `tests/browser/png.spec.ts`.

Licences: this package MIT; png crate and wasm-bindgen MIT OR
Apache-2.0 (see the repo's THIRD_PARTY_LICENSES.md).
