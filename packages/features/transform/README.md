# @dusrel/image-transform

Pixel transforms for the @dusrel/image family — the exact,
no-quality-loss kind first: flips and quarter-turn rotations are
pure pixel permutations, and arbitrary angles, background fill
and true perspective warps are here too.

```bash
npm install @dusrel/image-transform
```

```ts
import { flipHorizontal, rotateQuarter, rotateArbitrary } from '@dusrel/image-transform';

const flipped = flipHorizontal(imageData);
const turned = rotateQuarter(imageData, 1);      // 90° CW, lossless
const tilted = rotateArbitrary(imageData, 12.5, { r: 255, g: 255, b: 255 });
```

## API

| Export | What it does |
| --- | --- |
| `flipHorizontal(pixels)` / `flipVertical(pixels)` | Exact mirror permutations |
| `rotateQuarter(pixels, turns)` | 90°-step rotation (turns may be negative), exact |
| `rotateArbitrary(pixels, degrees, background?)` | Any angle via the platform canvas; exact path for 90° multiples |
| `fillBackground(pixels, color)` | Source-over composite onto a solid colour |
| `perspectiveMatrix(from, to)` | 3×3 homography between two quads (pure math) |
| `applyMatrix(m, point)` / `invertMatrix(m)` | Matrix helpers |
| `warpPerspective(pixels, matrix, { width, height, sampling })` | CPU perspective warp (bilinear default) |

Everything operates on a structural `PixelData` (`{ data, width,
height }`) — the same shape as DOM `ImageData`, so values pass
between this package, the codec packages and `@dusrel/image`'s
`imageDataPlugin` with no adapters, and the pure functions run in
workers and tests alike.

## Honest notes

- Quarter turns and flips never resample: output pixels are the
  input pixels, rearranged. Arbitrary angles necessarily resample
  (canvas) — for multiples of 90°, `rotateArbitrary` silently
  takes the exact path.
- `warpPerspective` is a per-pixel CPU loop: correct everywhere,
  but for very large images run it in a worker.
- Status: implemented (Phase 3). Verified by Node unit tests
  (exact permutations, homography corners, identity warp) and a
  Playwright suite (canvas rotation + pipeline integration) in
  Chromium, Firefox and WebKit.
