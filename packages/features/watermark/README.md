# @dusrel/image-watermark

Image and text watermarks for the @dusrel/image family, with
developer-controlled position, opacity, scale and tiling.

```bash
npm install @dusrel/image-watermark
```

```ts
import { applyWatermark, drawTextWatermark } from '@dusrel/image-watermark';

const branded = applyWatermark(imageData, logoData, {
  position: 'bottom-right', opacity: 0.7, scale: 0.2, margin: 16,
});
const stamped = drawTextWatermark(imageData, '© dusrel', { position: 'tile', opacity: 0.25 });
```

## API

| Export | What it does |
| --- | --- |
| `applyWatermark(image, mark, options?)` | Image mark: scale (aspect preserved) → place/tile → source-over composite. Pure. |
| `drawTextWatermark(image, text, options?)` | Text mark via the platform canvas, same placements (browser/worker) |
| `placementsFor(w, h, markAspect, resolved)` | The shared layout maths |
| `resolveWatermarkOptions(options)` | Validated options with defaults |
| `compositeOne(base, mark, placement, opacity)` / `scalePixels(p, w, h)` | Compositor + bilinear scaler building blocks |

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `position` | `'bottom-right'` | `top-left` / `top-right` / `bottom-left` / `bottom-right` / `center` / `tile` |
| `opacity` | `0.7` | Global mark opacity, 0..1 |
| `scale` | `0.2` | Mark width as a fraction of the image width |
| `margin` | `16` | Px from the image edge (positioned modes) |
| `tileGap` | one mark width | Extra px between tiles |
| `font` / `color` | `'600 24px sans-serif'` / `'#ffffff'` | Text marks |

For text marks, the text is measured with the final font, then
the same layout rule applies: placement width = image width ×
`scale`, height from the text's aspect, font drawn scaled to fit.

## Notes

- Compositing is true source-over with premultiplied-correct
  maths (same formulation as @dusrel/image-transform's
  fillBackground) — semi-transparent marks over semi-transparent
  images behave correctly.
- Status: implemented (Phase 3). Layout and blending are proven
  by exact-value Node unit tests; the Playwright suite proves
  canvas text drawing and pipeline integration in Chromium,
  Firefox and WebKit.
