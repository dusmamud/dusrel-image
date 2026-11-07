# @dusrel/image-core

Tiny zero-dependency core: decode helpers (createImageBitmap + EXIF orientation), Canvas/OffscreenCanvas engine, worker runtime, shared types and typed errors. Size budget: 10 KB gzip. No WASM, no UI, no network.

> Status: Phase 1 implemented — `processImage` (decode → crop → rotate/flip → resize → encode), target-size mode, worker handler, typed errors. Unit tests in `test/`, real-browser tests in `tests/browser/core.spec.ts`.
