# @dusrel/image-oxipng

Lossless PNG optimisation for the @dusrel/image family, powered by
the Rust [`oxipng`](https://crates.io/crates/oxipng) crate compiled
to WebAssembly. Same pixels, smaller file — oxipng re-compresses,
re-filters and strips metadata; it never touches pixel values.

```bash
npm install @dusrel/image-oxipng
```

```ts
import { optimize } from '@dusrel/image-oxipng';

const smaller = await optimize(pngBytes, { level: 4, strip: 'safe' });
```

## API

| Export | What it does |
| --- | --- |
| `optimize(bytes, options?)` | PNG `ArrayBuffer`/`Uint8Array` → optimised PNG `ArrayBuffer` |
| `init()` | Preload the WASM module |
| `setCodecAssets({...})` | Override asset URLs (CDN hosting, tests) |
| `resolveOptions(options?)` | The validated options with defaults applied |

## Options

| Option | Values | Default | Notes |
| --- | --- | --- | --- |
| `level` | `0..6` | `2` | oxipng's preset scale; higher is slower and smaller |
| `strip` | `'none' \| 'safe' \| 'all'` | `'safe'` | 'safe' drops non-display chunks (text, EXIF, …); 'all' drops every non-critical chunk |
| `interlace` | `'keep' \| 'off' \| 'on'` | `'keep'` | oxipng's own presets de-interlace by default; this package preserves the input's structure unless you ask otherwise. This is also where Adam7 control lives — the `png` crate's encoder (see `@dusrel/image-png`) cannot encode interlaced PNGs |
| `force` | `boolean` | `false` | Return output even when it is not smaller |

## Build configuration (honest notes)

- `oxipng` is compiled with `default-features = false` plus its
  `freestanding` feature: no CLI binary deps, **no rayon** (the
  family default is single-threaded — ADR-0006), no zopfli, and
  libdeflate built without libc, as WASM requires.
- Module size as committed: `codec/oxipng.wasm` **296,859 B**.

## Provenance

Built reproducibly from `native/rust` (pinned `rust:1.99.1` +
wasm-bindgen 0.2.130, `oxipng = 10.2.1`) by the repo's `wasm-build`
workflow; the Docker build ends with a functional smoke gate that
hand-builds a fat PNG and demands a smaller, chunk-stripped,
pixel-exact result. Verified again in Chromium, Firefox and
WebKit by `tests/browser/oxipng.spec.ts` (pixel checks cross-use
`@dusrel/image-png`'s decoder).

Licences: this package MIT; oxipng MIT (see the repo's
THIRD_PARTY_LICENSES.md).
