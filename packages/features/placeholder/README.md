# @dusrel/image-placeholder

ThumbHash and BlurHash image placeholders, implemented from
spec in pure TypeScript — no dependencies, no WASM. Encode
once when an image is processed; store the tiny string/bytes
next to the image record; decode anywhere to show a blurred
preview (and reserve the right layout box) while the real
image loads.

```ts
import {
  encodeThumbHash,
  decodeThumbHash,
  thumbHashToBase64,
  encodeBlurHash,
  decodeBlurHash,
} from "@dusrel/image-placeholder";

const thumb = thumbHashToBase64(encodeThumbHash(pixels)); // ~35 chars
const preview = decodeThumbHash(thumbHashFromBase64(thumb)); // PixelData ~32px

const blur = encodeBlurHash(pixels); // "LRI5u53.a|?Z_e9~fQredLeqfQeq"
const preview2 = decodeBlurHash(blur, 32, 18);
```

## Which one?

- **ThumbHash** (~25–35 bytes): more detail per byte, more
  accurate colours, and it encodes the **aspect ratio** and
  an **alpha channel** — `thumbHashAspectRatio(hash)` gives
  width/height from the hash alone, so layout shift is
  avoidable without storing dimensions separately.
  `thumbHashAverageColor(hash)` returns the 0..1 average
  colour when even a decoded preview is too much.
- **BlurHash** (20–30 chars): the widely deployed format —
  pick it when hashes must interoperate with existing
  BlurHash ecosystems (Mastodon, Signal, …). Component counts
  are configurable (`componentX`/`componentY`, 1–9, default
  4×3). No aspect ratio, no alpha.

Both implementations mirror their reference algorithms'
math exactly — the test suite pins oracle vectors generated
with the reference `thumbhash` and `blurhash` packages, so
hashes are interchangeable with other implementations.
(ThumbHash decode writes into this family's
`Uint8ClampedArray` PixelData, so a channel can differ by at
most 1 from the reference's truncating writes.)

## Control

- Encoders box-average the input down first (`maxSize`:
  ThumbHash default/cap 100, BlurHash default 128, pass
  `Infinity` for full size) — the algorithms discard fine
  detail anyway, and encoding a 4000px photo raw is wasted
  work.
- `decodeBlurHash(hash, w, h, { punch })` — `punch` scales
  the detail terms (1 = faithful).
- `averageColor(pixels)` — the plain 0..255 average, for a
  zero-decoding solid-colour placeholder.
- All functions take and return the family's structural
  `PixelData`, so output drops straight into
  `imageDataPlugin` from `@dusrel/image`. Validation failures
  are `RangeError`s with stable messages.
