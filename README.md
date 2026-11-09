# dusrel-image

A tiny, **no-backend**, client-side image processing family for the web browser —
compress, crop, resize (reduce), rotate, flip, convert and optimise images entirely
on the user's device. No uploads, no server, no image ever leaves the browser.

Built from scratch under the `@dusrel/` npm scope, modelled on the proven
sub-package architecture of jSquash / Google Squoosh: every codec and tool is its
own separately installable, separately lazy-loaded package.

> Status: **1.0.0 — published on npm (2026-11-08).** All 24 packages are
> live under the `@dusrel/` scope and were verified end-to-end in a
> separate React + Vite consumer project
> ([dusrel-consumer-test](https://github.com/dusmamud/dusrel-consumer-test),
> 43/43 pack-smoke checks). The locked decisions in `docs/` (PRD, TRD,
> ADRs) governed the build; release record in `docs/RELEASE.md`.

## Install

```sh
npm install @dusrel/image
```

Add only the codec and feature packages you use — each is a separate
install, e.g. `npm install @dusrel/image-jpeg @dusrel/image-webp`.

## Packages

| Package | Purpose |
| --- | --- |
| `@dusrel/image` | Main package — one pipeline that joins everything |
| `@dusrel/image-core` | Tiny zero-dependency Canvas / OffscreenCanvas core |
| `@dusrel/image-jpeg` | MozJPEG codec (WASM, lazy-loaded) |
| `@dusrel/image-webp` | libwebp codec (WASM, lazy-loaded) |
| `@dusrel/image-avif` | libavif codec (WASM, lazy-loaded) |
| `@dusrel/image-png` | PNG encode / decode (Rust, WASM) |
| `@dusrel/image-oxipng` | OxiPNG lossless PNG optimiser (Rust, WASM) |
| `@dusrel/image-quantize` | PNG palette quantisation (lossy PNG, up to ~75% smaller) |
| `@dusrel/image-resize` | High-quality resize (Lanczos and more) |
| `@dusrel/image-jxl` | JPEG XL codec — experimental |
| `@dusrel/image-qoi` | QOI codec — optional |
| `@dusrel/image-heic` | HEIC decode — native-first (Safari), libheif WASM fallback |
| `@dusrel/image-crop` | Interactive cropping (Web Components) |
| `@dusrel/image-transform` | Rotate, flip, perspective, background fill |
| `@dusrel/image-adjust` | Brightness, contrast, saturation, sharpness, filters |
| `@dusrel/image-metadata` | EXIF read / strip / preserve, GPS removal |
| `@dusrel/image-watermark` | Image and text watermarks |
| `@dusrel/image-batch` | Multi-file queue, progress, cancellation, worker pool |
| `@dusrel/image-gif` | GIF optimisation (incl. animated) |
| `@dusrel/image-svg` | SVG optimisation |
| `@dusrel/image-placeholder` | ThumbHash + BlurHash placeholder encode / decode |
| `@dusrel/image-react` / `-vue` / `-svelte` | Thin framework wrappers |

## Design promises

1. **No backend, ever.** All processing is client-side. The packages make no
   network calls except fetching their own WASM assets.
2. **Tiny by default.** The core is zero-dependency with a hard size budget
   (10 KB, enforced in CI via size-limit). Heavy codecs download only when selected.
3. **Maximum features, maximum control.** Sensible defaults for beginners;
   every step, codec, fallback and threshold overridable for professionals.
4. **One consistent API shape** across every sub-package: input, options,
   progress, cancellation (AbortSignal) and typed errors.
5. **Single-threaded by default.** Multi-threaded WASM (SharedArrayBuffer /
   COOP-COEP) is strictly opt-in.

## Documentation

Start with `docs/PRD.md` (product) and `docs/TRD.md` (technical). All planning
documents live in `docs/`; every major decision is recorded in `docs/adr/`.

## Licence

MIT for dusrel-image's own code. Third-party codecs keep their own licences
(Apache-2.0 and others) — see `NOTICE` and `THIRD_PARTY_LICENSES.md`.
One exception, fenced to a single package: the decoder engine inside
`@dusrel/image-heic` (libheif + libde265) is LGPL-3.0; the package's own
code stays MIT (ADR-0008).
