# Quickstart

## Install

```bash
npm install @dusrel/image
```

Add only the sub-packages you need — codecs and features are
separately installable and their WASM loads lazily:

```bash
npm install @dusrel/image-avif @dusrel/image-crop
```

## Process an image

```ts
import { processImage } from '@dusrel/image';

const { blob, report } = await processImage(file, {
  format: 'image/webp',   // built in: 'image/jpeg' | 'image/png' | 'image/webp'
  quality: 0.8,           // 0..1 (codec packages use their native scales)
  resize: { width: 1600 },
  crop: { x: 80, y: 60, width: 640, height: 480 },
});

console.log(report.stepsApplied, report.savingsRatio);
```

Formats beyond the canvas three (AVIF, JPEG XL, QOI, …) come from
the codec packages — you register the encoder you installed, and
the format becomes available everywhere:

```ts
import { encode } from '@dusrel/image-avif';

const { blob } = await processImage(file, {
  format: 'image/avif',
  codecs: [{ mimeType: 'image/avif', encode: (d) => encode(d, { quality: 50, speed: 9 }) }],
});
```

Instead of guessing a quality, give a byte budget —
`maxSizeBytes: 200_000` — and read `result.targetSizeMet` to
know honestly whether it was reached.

## Compose with the pipeline

```ts
import { pipeline, codecPlugin, imageDataPlugin } from '@dusrel/image';
import { encode } from '@dusrel/image-avif';
import { adjust } from '@dusrel/image-adjust';

const { blob } = await pipeline(file)
  .resize({ width: 1200 })
  .use(imageDataPlugin({ name: 'adjust', transform: (d) => adjust(d, { saturation: 0.1 }) }))
  .use(codecPlugin({ mimeType: 'image/avif', encode: (d) => encode(d, { quality: 55 }) }))
  .run();
```

## Crop with the component

```html
<script type="module">
  import { defineCropElement } from '@dusrel/image-crop/element';
  defineCropElement();
</script>

<dusrel-crop src="photo.jpg" aspect="16/9"></dusrel-crop>
```

The component returns geometry only (natural pixels); feed
`event.detail.crop` into `processImage`'s `crop` option.
React, Vue and Svelte users get typed wrappers from
`@dusrel/image-react`, `@dusrel/image-vue` and
`@dusrel/image-svelte`.

## WASM codecs with Vite

Codec packages (`@dusrel/image-jpeg`, `-webp`, `-avif`, `-png`,
`-jxl`, `-qoi`, `-heic`, `-oxipng`, `-quantize`, `-resize`, `-gif`)
load their `.wasm` and glue `.js` from URLs resolved relative to
their own module — no configuration needed in production builds:
Vite emits the codec files as assets and rewrites the URLs.

**Vite dev is different.** The dev server pre-bundles dependencies
into `node_modules/.vite/deps/`, which relocates the codec code and
breaks those relative URLs (the WASM request returns the page HTML
instead of the binary). Two fixes, both verified against the
published 1.0.0 packages:

Option A — exclude the codec packages from pre-bundling
(keeps the default asset URLs working):

```ts
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: [
      '@dusrel/image-jpeg', '@dusrel/image-webp', '@dusrel/image-avif',
      '@dusrel/image-png', '@dusrel/image-oxipng', '@dusrel/image-quantize',
      '@dusrel/image-resize', '@dusrel/image-jxl', '@dusrel/image-qoi',
      '@dusrel/image-heic', '@dusrel/image-gif',
    ],
  },
});
```

Option B — hand the loader bundler-emitted URLs explicitly
(works in dev and production, no config change):

```ts
import { setCodecAssets } from '@dusrel/image-jpeg';
import encJs from '@dusrel/image-jpeg/codec/mozjpeg_enc.js?url';
import encWasm from '@dusrel/image-jpeg/codec/mozjpeg_enc.wasm?url';
import decJs from '@dusrel/image-jpeg/codec/mozjpeg_dec.js?url';
import decWasm from '@dusrel/image-jpeg/codec/mozjpeg_dec.wasm?url';

setCodecAssets({
  encodeJsUrl: encJs,
  encodeWasmUrl: encWasm,
  decodeJsUrl: decJs,
  decodeWasmUrl: decWasm,
});
```

Every codec package accepts the same `setCodecAssets` override —
it is also the mechanism for self-hosting the codec files or
pinning them to a CDN.

## No build step? Use the CDN

See `examples/cdn` in the repository for an import-map page
that runs entirely from CDN modules.
