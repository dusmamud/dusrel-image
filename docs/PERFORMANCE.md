# Performance & Benchmarks: dusrel-image

## Budgets (hard gates in CI, via size-limit)

See TRD.md section 5. A budget increase requires an ADR.

## Benchmark method

- Corpus: `benchmarks/corpus/` — a fixed, licence-clean set of real images
  (DSLR-style photos, screenshots/UI, social exports, mixed 200 KB - 12 MB),
  documented per image. Synthetic test cards are not used for headline
  numbers (they flatter codecs).
- Environment: recorded per run (browser version, device class, warm cache
  for WASM). Medians are reported; expect roughly +-15% per-image variance.
- Every PR that touches processing runs the benchmark workflow and posts a
  comparison comment against the base branch.

## Reference numbers (upstream research, Nov 2026 — to be re-measured)

Measured on a 100-image mixed corpus at quality 0.75 with the same engines
dusrel-image will ship:

| Format | Engine | Median reduction |
| --- | --- | --- |
| JPEG | MozJPEG | ~53% |
| PNG (lossy) | imagequant + PNG | ~75% |
| WebP | libwebp (re-encode) | ~17% |
| AVIF | libavif (speed 6 in that study) | ~59% |
| GIF | gifsicle -O3 lossy | ~75% |
| SVG | SVGO multipass | ~42% |

Note: dusrel-image ships AVIF at default speed 9 (see CODEC_GUIDE.md), so its
AVIF time/size balance will differ from the study's speed-6 row.

## Time targets

- Interactive operations (resize/crop/rotate + JPEG/WebP encode of a 12 MP
  photo) should complete in under ~2 s on a mid-range laptop, under ~5 s on
  a mid-range phone, in the worker, without blocking the UI.
- AVIF is exempt from time targets but must always show progress and support
  cancellation.
