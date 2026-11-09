# Cookbook

Task-first recipes. Every snippet is copied from a pattern the
project itself runs — in the [playground](https://dusmamud.github.io/dusrel-image/playground/)
or in the consumer test app — against the published packages.

## Compress under a byte budget

Don't guess a quality — give a budget and check the result
honestly:

```ts
import { processImage } from '@dusrel/image';

const result = await processImage(file, {
  format: 'image/webp',
  maxSizeBytes: 200_000,
});

console.log(result.targetSizeMet); // false = smallest best-effort result
console.log(result.report.finalBytes, result.report.stepsApplied);
```

## Convert to AVIF (or WebP / JPEG XL / QOI) with the real codec

Canvas cannot encode AVIF. Register the codec package's encoder
and the format works everywhere `format` is accepted:

```ts
import { processImage } from '@dusrel/image';
import { encode } from '@dusrel/image-avif';

const { blob } = await processImage(file, {
  format: 'image/avif',
  resize: { width: 1600 },
  codecs: [{ mimeType: 'image/avif', encode: (d) => encode(d, { quality: 50, speed: 9 }) }],
});
```

The same shape works for `@dusrel/image-jpeg` (MozJPEG),
`@dusrel/image-webp` (libwebp), `@dusrel/image-png`,
`@dusrel/image-jxl` and `@dusrel/image-qoi` — just swap the
`mimeType` and the `encode` function.

## Turn an iPhone HEIC photo into a JPEG

Browsers other than Safari cannot decode HEIC. `@dusrel/image-heic`
decodes natively where the browser can and falls back to its
WASM decoder (libheif) everywhere else:

```ts
import { decodeHeic, isHeic } from '@dusrel/image-heic';
import { encode } from '@dusrel/image-jpeg';

const bytes = new Uint8Array(await file.arrayBuffer());
if (isHeic(bytes)) {
  const imageData = await decodeHeic(bytes); // upright RGBA pixels
  const jpeg = await encode(imageData, { quality: 85 });
  const blob = new Blob([jpeg], { type: 'image/jpeg' });
}
```

## Strip GPS (or all) metadata before upload

Byte-level surgery — the image data is never re-encoded:

```ts
import { stripMetadata } from '@dusrel/image-metadata';

const gpsFree = stripMetadata(bytes, { mode: 'gps-only' });
const bare = stripMetadata(bytes, { mode: 'all' });
```

## Read EXIF and GPS coordinates

```ts
import { readMetadata } from '@dusrel/image-metadata';

const meta = readMetadata(bytes);
meta.exif?.make;                       // camera make
meta.exif?.dateTimeOriginal;           // when the photo was taken
meta.exif?.gps;                        // { latitude, longitude } in decimal degrees
```

## Add a text watermark

```ts
import { pipeline, imageDataPlugin } from '@dusrel/image';
import { drawTextWatermark } from '@dusrel/image-watermark';

const { blob } = await pipeline(file)
  .resize({ width: 1200 })
  .use(imageDataPlugin({
    name: 'watermark',
    transform: (d) => drawTextWatermark(d, '© your name', { position: 'bottom-right' }),
  }))
  .toFormat('image/jpeg', 0.85)
  .run();
```

## Generate ThumbHash + BlurHash placeholders

```ts
import { blobToImageData } from '@dusrel/image';
import { encodeThumbHash, encodeBlurHash, thumbHashToBase64 } from '@dusrel/image-placeholder';

const img = await blobToImageData(file);
const pixels = { data: img.data, width: img.width, height: img.height };

const thumbHash = thumbHashToBase64(encodeThumbHash(pixels)); // carries an aspect ratio + average colour
const blurHash = encodeBlurHash(pixels, { componentX: 4, componentY: 3 });
```

Both encoders are pure TypeScript — no WASM, no dependencies.

## Make an animated GIF from frames

```ts
import { encode } from '@dusrel/image-gif';

const gif = await encode(
  frames.map((data, i) => ({ data, delay: 120 })), // delay in ms per frame
  { repeat: 0 },                                    // 0 = loop forever
);
```

A single frame works too — that is how the playground offers
GIF as an output format.

## Resize with the WASM resampler (Lanczos3)

Canvas resizing is bilinear-ish. For sharper downscales, run the
Rust `resize` package as a pixel step:

```ts
import { pipeline, imageDataPlugin, toImageData } from '@dusrel/image';
import { resize } from '@dusrel/image-resize';

const { blob } = await pipeline(file)
  .use(imageDataPlugin({
    name: 'resize-wasm',
    transform: async (d) => {
      const out = await resize(toImageData(d), { width: 800, height: 450, filter: 'lanczos3' });
      return { data: out.data, width: out.width, height: out.height };
    },
  }))
  .toFormat('image/webp', 0.8)
  .run();
```

Seven filters are available — `nearest`, `triangle`,
`catmull-rom`, `mitchell`, `bspline`, `gaussian`, `lanczos3` —
with premultiplied-alpha handling by default.

## Shrink a PNG losslessly with OxiPNG

```ts
import { optimize } from '@dusrel/image-oxipng';

const smaller = await optimize(new Uint8Array(await pngBlob.arrayBuffer()), {
  level: 4,          // 0..6
  strip: 'safe',     // keep colour profiles, drop the rest
});
```

## Process many files with one settings object

```ts
import { processBatch } from '@dusrel/image';

const results = await processBatch(files, {
  format: 'image/webp',
  quality: 0.8,
  concurrency: 3,
  onBatchProgress: ({ completed, total }) => updateBar(completed / total),
});

for (const item of results) {
  if (item.status === 'fulfilled') save(item.result.blob);
  else console.error(item.index, item.error);
}
```

For custom per-item work (not just `processImage`), use
`runBatch` / `BatchQueue` from `@dusrel/image-batch` — retries,
per-item timeouts, pause/abort and a worker pool included.

## Optimise an SVG file

```ts
import { optimizeSvg, optimizeSvgWithStats } from '@dusrel/image-svg';

const out = optimizeSvg(svgText, { multipass: true });
const { output, stats } = optimizeSvgWithStats(svgText); // sizes before/after
```
