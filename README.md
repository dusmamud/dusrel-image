<p align="center">
  <img src="apps/docs-site/public/logo.svg" width="120" alt="@dusrel/image logo">
</p>

<h1 align="center">@dusrel/image</h1>

<p align="center"><strong>Client-side image processing, done properly.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dusrel/image"><img src="https://img.shields.io/npm/v/%40dusrel%2Fimage.svg" alt="npm version"></a>
  <a href="https://github.com/dusmamud/dusrel-image/actions/workflows/ci.yml"><img src="https://github.com/dusmamud/dusrel-image/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/dusmamud/dusrel-image.svg" alt="Licence: MIT"></a>
  <a href="https://dusmamud.github.io/dusrel-image/"><img src="https://img.shields.io/badge/docs-online-4d90fe.svg" alt="Documentation"></a>
</p>

## What it is

`@dusrel/image` is a family of 24 TypeScript packages for processing images
entirely in the web browser: compress, crop, resize, rotate, flip, convert
and optimise, with no backend and no uploads. Every image stays on the
user's device.

The design follows the sub-package architecture proven by jSquash /
Google Squoosh: a tiny zero-dependency Canvas core, plus real codecs
(MozJPEG, libwebp, libavif, libjxl and several Rust crates) compiled to
WebAssembly — each in its own package, loaded lazily only when used.
Defaults are simple; every step, codec, fallback and threshold can be
overridden.

**Current release: 1.0.1** — all 24 packages are published on npm under
the `@dusrel/` scope and versioned in lockstep.

## Highlights

- **No backend, ever.** All processing is client-side. The packages make
  no network calls except fetching their own WASM assets.
- **Tiny core.** `@dusrel/image-core` is zero-dependency and held to a
  10 KB size budget in CI (size-limit); codec WASM is never bundled into
  the core.
- **Real codecs, lazily loaded.** MozJPEG, libwebp, libaom + libavif,
  libjxl, and Rust `png`, oxipng, `resize`, quantizr, `qoi` and `gif`
  modules — downloaded on demand, worker-ready.
- **Maximum control.** A fluent pipeline, a plugin system, fallback
  policies (`throw`, `return-original`, `downgrade-format`), byte
  budgets, progress callbacks and `AbortSignal` cancellation throughout,
  with typed errors carrying stable codes.
- **Single-threaded by default.** No SharedArrayBuffer requirement, so
  no COOP/COEP headers are needed; multi-threaded WASM is opt-in only.
- **Framework bindings.** React, Vue and Svelte packages built on one
  shared processor store, plus an accessible `<dusrel-crop>` Web
  Component for interactive cropping.
- **Proven in real browsers.** Every package has Playwright specs that
  run on Chromium, Firefox and WebKit in CI, and the published packages
  are exercised end-to-end by a separate consumer project (see
  Documentation below).

## Install

```sh
npm install @dusrel/image
```

Add only the codec and feature packages you use — each is a separate
install, and its WASM loads lazily:

```sh
npm install @dusrel/image-avif @dusrel/image-crop
```

## Quickstart

```ts
import { processImage } from '@dusrel/image';

const { blob, report } = await processImage(file, {
  format: 'image/webp', // built in: 'image/jpeg' | 'image/png' | 'image/webp'
  quality: 0.8, // 0..1 (codec packages use their native scales)
  resize: { width: 1600 },
  crop: { x: 80, y: 60, width: 640, height: 480 },
});

console.log(report.stepsApplied, report.savingsRatio);
```

Instead of guessing a quality, give a byte budget and check whether it
was met:

```ts
const result = await processImage(file, {
  format: 'image/webp',
  maxSizeBytes: 200_000,
});

console.log(result.targetSizeMet);
```

Formats beyond the canvas three (AVIF, JPEG XL, QOI and more) come from
the codec packages. Register the encoder you installed and the format
becomes available everywhere:

```ts
import { encode } from '@dusrel/image-avif';

const { blob } = await processImage(file, {
  format: 'image/avif',
  codecs: [
    {
      mimeType: 'image/avif',
      encode: (d) => encode(d, { quality: 50, speed: 9 }),
    },
  ],
});
```

More patterns — fluent pipeline, plugins, batch processing, the crop
component — are in the
[quickstart guide](https://dusmamud.github.io/dusrel-image/guide/quickstart)
and the [cookbook](https://dusmamud.github.io/dusrel-image/guide/cookbook).

## Packages

Every package is separately installable under the `@dusrel/` scope,
ESM-only, and versioned in lockstep. No codec WASM is ever bundled into
the core.

### Core (2)

| Package           | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `@dusrel/image`   | One-call processing, fluent pipeline, plugins, fallback policies, batch |
| `@dusrel/image-core` | The zero-dependency Canvas engine underneath                      |

### Codecs (10) — WASM, lazily loaded

| Package               | Engine                                                                |
| --------------------- | --------------------------------------------------------------------- |
| `@dusrel/image-jpeg`  | MozJPEG — progressive JPEG encode/decode                              |
| `@dusrel/image-webp`  | libwebp — lossy + lossless WebP                                       |
| `@dusrel/image-avif`  | libaom + libavif — AVIF encode/decode                                 |
| `@dusrel/image-png`   | Rust `png` crate — PNG encode/decode                                  |
| `@dusrel/image-oxipng` | OxiPNG — lossless PNG optimisation                                   |
| `@dusrel/image-resize` | Rust `resize` crate — high-quality resampling, 7 filters             |
| `@dusrel/image-quantize` | quantizr — palette quantisation for PNG-8 style savings            |
| `@dusrel/image-qoi`   | Rust `qoi` crate — lossless QOI encode/decode (experimental)          |
| `@dusrel/image-jxl`   | libjxl — JPEG XL encode/decode (experimental)                         |
| `@dusrel/image-heic`  | libheif + libde265 — HEIC/HEIF decode only, native-first on Safari (engine LGPL-3.0, wrapper MIT) |

### Features (9)

| Package                  | What it does                                                            |
| ------------------------ | ----------------------------------------------------------------------- |
| `@dusrel/image-crop`     | Crop geometry core + the accessible `<dusrel-crop>` Web Component       |
| `@dusrel/image-transform` | Flip, rotate, perspective warp                                         |
| `@dusrel/image-adjust`   | Brightness/contrast/exposure/gamma/hue/saturation, blur, sharpen        |
| `@dusrel/image-metadata` | EXIF read (incl. GPS), metadata strip (all or GPS-only)                 |
| `@dusrel/image-watermark` | Image + text watermarks, 9 placements and tiling                       |
| `@dusrel/image-batch`    | Worker-pool batch engine — retries, timeouts, pause/resume, memory caps |
| `@dusrel/image-gif`      | Animated GIF encode/decode/optimise — Rust `gif` crate                  |
| `@dusrel/image-svg`      | SVG optimisation — SVGO browser build, multipass + ID preservation      |
| `@dusrel/image-placeholder` | ThumbHash + BlurHash placeholders — pure TypeScript, aspect + alpha aware |

### Frameworks (3)

| Package                | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `@dusrel/image-react`  | `useProcessImage` / `useProcessBatch` hooks + `<DusrelCrop>`   |
| `@dusrel/image-vue`    | Composables + `<DusrelCrop>` with v-model                      |
| `@dusrel/image-svelte` | Store factories + `DusrelCrop.svelte` with `bind:crop`         |

## Browser support

The full browser matrix runs on CI in Chromium, Firefox and WebKit
(Playwright) and is green on the current release.

| Area                  | Chrome / Edge | Firefox       | Safari                          |
| --------------------- | ------------- | ------------- | ------------------------------- |
| Core + canvas formats | Supported     | Supported     | Supported (16.4+ for the worker path) |
| WASM codecs           | Supported     | Supported     | Supported                       |
| HEIC decode           | WASM fallback | WASM fallback | Native (17+), WASM fallback     |

The WASM builds are single-threaded by default, so no
Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy headers are
required. Full matrix and known quirks:
[Browser support](https://dusmamud.github.io/dusrel-image/guide/browser-support).

## Benchmarks

Measured with `benchmarks/run.mjs` (Node v24, 2026-11-09) on a
deterministic synthetic corpus — a photo-like 384x288 input of 442,368
raw RGBA bytes. WASM codecs run single-threaded, as shipped.

| Operation                       | Output (bytes) | Median time |
| ------------------------------- | -------------: | ----------: |
| AVIF encode, quality 50, speed 9 |          7,285 |     25.0 ms |
| JPEG encode, quality 80 (MozJPEG) |         14,859 |     34.6 ms |
| WebP encode, quality 80 (libwebp) |         23,856 |     59.9 ms |
| PNG encode                      |        213,460 |     50.5 ms |

Full results: [`benchmarks/results.md`](benchmarks/results.md).
Methodology and budgets: [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md).

## Documentation

- **Docs site** — guides, the package index and the TypeDoc API
  reference: [dusmamud.github.io/dusrel-image](https://dusmamud.github.io/dusrel-image/)
- **Playground** — every codec and tool in the family, running live in
  your browser: [dusmamud.github.io/dusrel-image/playground](https://dusmamud.github.io/dusrel-image/playground/)
- **Wiki** — [github.com/dusmamud/dusrel-image/wiki](https://github.com/dusmamud/dusrel-image/wiki)
- **Consumer test** — the published packages installed into a separate
  React + Vite app, with a live in-browser test lab:
  [dusrel-consumer-test.pages.dev](https://dusrel-consumer-test.pages.dev/)
  ([source](https://github.com/dusmamud/dusrel-consumer-test))
- **npm** — [@dusrel/image](https://www.npmjs.com/package/@dusrel/image)
  and the rest of the `@dusrel/` scope
- **In this repo** — product and technical records live in `docs/`
  (start with `docs/PRD.md` and `docs/TRD.md`); every major decision is
  recorded in `docs/adr/`.

## Contributing

Issues and pull requests are welcome. This is a pnpm + Turborepo
monorepo with strict TypeScript throughout; packages are versioned in
lockstep with Changesets. See `docs/TESTING.md` for the test strategy
(unit, browser and smoke gates) and `docs/RELEASE.md` for how releases
are cut.

## Licence

MIT for dusrel-image's own code. Third-party codec engines keep their
own licences — see `NOTICE` and `THIRD_PARTY_LICENSES.md`. One
exception, fenced to a single package: the decoder engine inside
`@dusrel/image-heic` (libheif + libde265) is LGPL-3.0; the package's own
code stays MIT (ADR-0008).
