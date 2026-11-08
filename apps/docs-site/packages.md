# All packages

Every package is separately installable under the `@dusrel/`
scope, ESM-only, and versioned in lockstep. No codec WASM is
ever bundled into the core.

## Core

| Package | What it does |
| --- | --- |
| `@dusrel/image` | One-call processing, fluent pipeline, plugins, fallback policies, batch |
| `@dusrel/image-core` | The zero-dependency Canvas engine underneath |

## Codecs (WASM, lazily loaded)

| Package | Engine |
| --- | --- |
| `@dusrel/image-jpeg` | MozJPEG — progressive JPEG encode/decode |
| `@dusrel/image-webp` | libwebp — lossy + lossless WebP |
| `@dusrel/image-avif` | libaom + libavif — AVIF encode/decode |
| `@dusrel/image-png` | Rust `png` crate — PNG encode/decode |
| `@dusrel/image-oxipng` | OxiPNG — lossless PNG optimisation |
| `@dusrel/image-resize` | Rust `resize` crate — high-quality resampling, 7 filters |
| `@dusrel/image-quantize` | quantizr — palette quantisation for PNG-8 style savings |
| `@dusrel/image-qoi` | Rust `qoi` crate — lossless QOI encode/decode (Phase 5, experimental) |
| `@dusrel/image-jxl` | libjxl — JPEG XL encode/decode (Phase 5, experimental) |

## Features

| Package | What it does |
| --- | --- |
| `@dusrel/image-crop` | Crop geometry core + the accessible `<dusrel-crop>` Web Component |
| `@dusrel/image-transform` | Flip, rotate, perspective warp |
| `@dusrel/image-adjust` | Brightness/contrast/exposure/gamma/hue/saturation, blur, sharpen |
| `@dusrel/image-metadata` | EXIF read (incl. GPS), metadata strip (all or GPS-only) |
| `@dusrel/image-watermark` | Image + text watermarks, 9 placements and tiling |
| `@dusrel/image-batch` | Worker-pool batch engine — retries, timeouts, pause/resume, memory caps |
| `@dusrel/image-gif` | Animated GIF encode/decode/optimise — Rust `gif` crate (Phase 5) |
| `@dusrel/image-svg` | SVG optimisation — SVGO browser build, multipass + ID preservation (Phase 5) |
| `@dusrel/image-placeholder` | ThumbHash + BlurHash placeholders — pure TypeScript, aspect + alpha aware (Phase 5) |

## Frameworks

| Package | What it does |
| --- | --- |
| `@dusrel/image-react` | `useProcessImage` / `useProcessBatch` hooks + `<DusrelCrop>` |
| `@dusrel/image-vue` | Composables + `<DusrelCrop>` with v-model |
| `@dusrel/image-svelte` | Store factories + `DusrelCrop.svelte` with `bind:crop` |

