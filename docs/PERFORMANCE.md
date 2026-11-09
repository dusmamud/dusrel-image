# Performance & Benchmarks: dusrel-image

## Budgets (hard gates in CI, via size-limit)

See TRD.md section 5. A budget increase requires an ADR.

## Benchmark method

- Runner: `benchmarks/run.mjs` (Node, against the built packages). The
  Benchmarks workflow runs it weekly and on demand and uploads the
  report as an artifact; `benchmarks/results.md` is the committed
  record of the latest run.
- Corpus: three deterministic synthetic images generated inside the
  runner from a seeded PRNG — a photo-like gradient with per-pixel
  noise (384×288), flat UI-like blocks (800×600) and an alpha pattern
  (256×256). Licence-clean by construction: the generator is the
  source. A corpus of real photographs is future work; until then,
  treat the numbers as regression tracking, not marketing claims.
- Times are medians (5 runs after 1 warmup; AVIF 3, metadata 25),
  single-threaded WASM exactly as shipped. Node timings differ from
  browser timings; the Playwright suite is the browser correctness
  gate, this benchmark is the size/time regression gate.

## Measured numbers (benchmarks/run.mjs, 2026-11-09, Node 24)

Same photo-like input (384×288, 442,368 raw RGBA bytes) through each
encoder:

| Operation | Out (bytes) | Median (ms) |
| --- | ---: | ---: |
| AVIF encode q50, speed 9 | 7,285 | 31.1 |
| JPEG encode q80 (MozJPEG) | 14,859 | 34.6 |
| WebP encode q80 (libwebp) | 23,856 | 59.1 |
| PNG encode (lossless) | 213,460 | 50.5 |
| OxiPNG optimise of that PNG, level 2 | 191,632 | 122.1 |
| JPEG decode | — | 2.7 |
| Resize lanczos3 to 50% | — | 4.0 |

Full table (14 operations, incl. quantize, placeholders, metadata,
SVG): `benchmarks/results.md`. Upstream research figures quoted during
planning (MozJPEG ~53% median saving at q75 on real photos, etc.) were
superseded by these first-party measurements on 2026-11-09.

## Time targets

- Interactive operations (resize/crop/rotate + JPEG/WebP encode of a 12 MP
  photo) should complete in under ~2 s on a mid-range laptop, under ~5 s on
  a mid-range phone, in the worker, without blocking the UI.
- AVIF is exempt from time targets but must always show progress and support
  cancellation.
