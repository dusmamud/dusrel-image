# Core concepts

How the family fits together, and the ideas every package shares.

## Two layers, one API

**Layer A — the canvas core** (`@dusrel/image-core`, ~3 KB):
decodes with `createImageBitmap`, applies geometry on Canvas 2D /
`OffscreenCanvas`, and encodes JPEG, PNG and WebP with the
browser's own encoder. Zero dependencies, zero downloads — this is
what runs when you ask for a built-in format.

**Layer B — WASM codec packages**: MozJPEG, libwebp, libavif, the
Rust `png` / `resize` / `quantize` / `qoi` modules, libjxl,
libheif and friends. Each is its own `@dusrel/` package with its
own lazily loaded WASM (never bundled into the core), its own
native option scale, and the same function shape as everything
else: `encode(imageData, options)`, `decode(bytes)`.

`@dusrel/image` sits on top of both: one-call `processImage`,
the fluent `pipeline()`, plugins, fallback policies and batch —
whichever layer serves a step, the call looks the same.

## One options object

Every operation takes `(input, options)`:

- `signal` — an `AbortSignal`; aborting rejects with code `aborted`.
- `onProgress` — step callbacks (`decode → transform → encode → done`).
- Quality is **0..1** in the core and the flagship. Codec packages
  use their **native scales** (MozJPEG 1..100, libaom 0..100 with
  `speed` 0..10, …) — each package's README states its scale.

Processing applies steps in a fixed order, whatever order you
declare them in:

```
crop → transform (rotate/flip) → resize → adjust → watermark → encode
```

## Plugins and codec registration

Two plugin shapes cover almost everything:

- `imageDataPlugin({ name, transform })` — a step that receives
  decoded pixels and returns new pixels. This is how
  `@dusrel/image-adjust`, `-transform`, `-watermark` and your own
  code compose into a run.
- `codecPlugin({ mimeType, encode })` — an encoder for a format
  the canvas cannot produce. Register codecs either per-call with
  `processImage(input, { codecs: [...] })`, or in a pipeline with
  `.use(codecPlugin(...))` / `.codec(...)`.

Asking for a format nobody registered throws a typed
`unsupported-format` error **before** any work happens — the
engine never silently falls back to another format. A plugin
that throws is wrapped as a typed `plugin-failed` error with the
original error as `cause`.

## Fallback policies

`processImage` accepts `fallback: 'throw' | 'return-original' | 'downgrade-format'`
(default `'throw'`). Downgrading walks a fixed chain
(AVIF → WebP → JPEG) and every fallback that fires is named in
`report.fallbacks` — nothing is hidden.

## The process report

Every flagship call resolves with `{ blob, report, targetSizeMet? }`.
The report is the audit trail of the run:

| Field | Meaning |
| --- | --- |
| `engine` | Which engine produced the output (`"canvas"`) |
| `originalBytes` / `finalBytes` | Sizes before / after |
| `savingsRatio` | `1 − final/original` (negative = grew) |
| `width` / `height` / `format` | Output geometry and MIME type |
| `stepsApplied` | e.g. `["crop", "resize", "plugin:adjust", "codec:avif"]` |
| `durationMs` | Wall time of the run |
| `fallbacks` | Fallback policies that fired, if any |

With a byte budget (`maxSizeBytes`), the engine binary-searches
quality for the smallest acceptable result; `result.targetSizeMet`
tells you honestly whether the budget was met, and the smallest
best-effort result is returned either way.

## Typed errors

Failures are `DusrelImageError`s with a stable string `code` —
branch on the code, not the message:

| Code | When |
| --- | --- |
| `invalid-input` | The input could not be interpreted as an image source |
| `invalid-options` | Contradictory or out-of-range options |
| `decode-failed` | The source bytes could not be decoded |
| `encode-failed` | Encoding failed |
| `unsupported-format` | The requested format is not built in and no codec was registered |
| `platform-unsupported` | The browser lacks a required capability |
| `plugin-failed` | A plugin threw (original error on `cause`) |
| `aborted` | The `AbortSignal` fired |

`isDusrelImageError(value)` narrows unknown errors.

## Workers

Nothing in the core blocks you from the main thread by design —
decoding and canvas work are async — but heavy batches belong in
workers:

- `@dusrel/image-core` exports `installWorkerHandler()`: call it
  inside a Web Worker and the core answers `processImage`
  requests over RPC.
- `@dusrel/image-batch` exports `createWorkerPool(url, { size })`
  for a pool of module workers, and `runBatch` / `BatchQueue`
  for in-page pools with retries, per-item timeouts, pause/abort
  and an in-flight byte cap.
