# Architecture: dusrel-image

Companion to TRD.md. This document describes how the pieces fit together.

## 1. The life of one image

1. **Input** — the developer hands the pipeline a File, Blob, ArrayBuffer,
   ImageData, image URL (same-app fetch) or an HTML image/canvas source.
2. **Decode** — `createImageBitmap` (with EXIF orientation applied by default)
   in a Web Worker; for formats the browser cannot decode but a WASM decoder
   can, the matching codec package decodes instead.
3. **Plan** — the developer's steps are validated and ordered: crop ->
   transform -> resize -> adjust -> watermark -> encode. The developer owns
   the order; the pipeline only guarantees each step receives valid pixels.
4. **Pixel steps** — run on OffscreenCanvas in the worker (Canvas 2D), or in
   a WASM tool package (e.g. high-quality resize) when the developer selected
   it.
5. **Encode** — native `convertToBlob` for the fast path, or the selected
   WASM codec (MozJPEG / libwebp / libavif / PNG+OxiPNG / quantize+PNG).
   Target-size mode loops encode with descending quality (bounded iterations)
   until the byte budget is met or the best effort is returned per the
   developer's fallback setting.
6. **Output** — Blob/File/ArrayBuffer/base64/object URL/ImageData plus a
   report: original/final bytes, dimensions, format, steps applied, time,
   and any fallbacks that occurred.

## 2. Package layering

- `image-core`: decode helpers, canvas engine, worker runtime, types, errors.
  Zero dependencies. Nothing visual, nothing WASM.
- Codec packages (`image-jpeg` etc.): depend on nothing from dusrel except
  shared types; each owns its WASM lifecycle (init, feature detection for
  SIMD/threads, single-thread default).
- Feature packages: depend on core; crop returns geometry, the pipeline
  applies it — UI never touches encoding.
- `image` (main): composes core + whichever codec/feature packages the
  developer installs; contains the pipeline, defaults ("easy mode") and the
  plugin registry.
- Framework wrappers: thin; they hold UI state and call the same pipeline.

## 3. Worker model

- A small internal RPC over postMessage (no external dependency) with
  request ids, progress events and AbortSignal bridging.
- A bounded pool (default 1 on mobile-class devices, configurable) managed by
  `image-batch`; single operations use a shared singleton worker.
- If Worker or OffscreenCanvas is unavailable/flaky (detected, e.g. some
  Safari cases), execution falls back to the main thread and the report
  records that fallback.

## 4. WASM lifecycle

- Codecs initialise lazily on first use of that format; initialisation is
  memoised per worker.
- Assets are versioned and immutable; a developer can override the asset base
  (CDN/self-host). Failures to load a codec produce a typed error and, if the
  developer configured it, a documented fallback (e.g. AVIF -> WebP).

## 5. Error model

All public errors are typed with stable `code` strings (see API_DESIGN.md):
input errors, unsupported format/feature, cancelled, timeout, out-of-memory /
platform limit, codec load failure, codec failure. Raw browser exceptions
never leak across the public API.

## 6. Security posture

Untrusted images are decoded in workers, away from the page's main thread
where possible. No dynamic code execution; strict CSP compatible. Codec
binaries are built reproducibly in Docker from pinned sources (WASM_BUILD.md)
and their hashes can be verified against the build workflow artifacts.
