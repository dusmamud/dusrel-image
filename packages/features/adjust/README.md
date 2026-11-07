# @dusrel/image-adjust

Colour and tone adjustments for the @dusrel/image family:
one-pass point adjustments plus convolution sharpening and
blur — all pure functions on the shared structural `PixelData`.

```bash
npm install @dusrel/image-adjust
```

```ts
import { adjust, sharpen, gaussianBlur } from '@dusrel/image-adjust';

const graded = adjust(imageData, { exposure: 0.7, saturation: 0.2, contrast: 0.1 });
const crisp = sharpen(graded, 0.6);
```

## API

| Export | What it does |
| --- | --- |
| `adjust(pixels, options)` | All point ops in ONE pass (order below) |
| `brightness` / `contrast` / `saturation` `(pixels, amount)` | Single-purpose wrappers |
| `grayscale(pixels)` / `sepia(pixels)` / `invert(pixels)` | Filter-class conversions |
| `resolveAdjustOptions(options)` | Validated options with defaults |
| `convolve3x3(pixels, kernel)` | Arbitrary 3×3 convolution (colour only, edges clamp) |
| `sharpen(pixels, amount)` | Classic sharpen kernel, amount 0..5 |
| `boxBlur(pixels, radius)` | Separable box blur |
| `gaussianBlur(pixels, sigma)` | Gaussian via the standard 3-box-pass approximation |

## The adjust() order (fixed and documented)

exposure → brightness → contrast → gamma → hue-rotate →
saturation → grayscale → sepia → invert. Alpha is never touched.
Ranges: brightness/contrast −1..1, exposure in EV stops,
gamma > 0, saturation −1..10 (−1 = greyscale), hueRotate in
degrees (wraps).

## Notes

- The point-op chain (exposure…gamma) runs through a 256-entry
  LUT, so stacking those four costs one lookup per channel.
- `gaussianBlur` uses the same three-box-pass approximation as
  the W3C filter-effects spec — visually indistinguishable from
  a true gaussian at photo sizes, at a fraction of the cost.
- Status: implemented (Phase 3). Exact-value unit tests in Node
  (luminance 54 for pure red, impulse-spread 255/9, EV doubling);
  Playwright suite in Chromium, Firefox and WebKit.
