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
  format: 'image/webp',   // 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'
  quality: 0.8,           // 0..1 (codec packages use their native scales)
  resize: { width: 1600 },
  crop: { x: 80, y: 60, width: 640, height: 480 },
});

console.log(report.stepsApplied, report.savingsRatio);
```

Instead of guessing a quality, give a byte budget —
`targetSize: 200_000` — and read `result.targetSizeMet` to
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

## No build step? Use the CDN

See `examples/cdn` in the repository for an import-map page
that runs entirely from CDN modules.
