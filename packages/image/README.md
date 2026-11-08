# @dusrel/image

Main package: one-call easy mode and the fluent pro pipeline that composes core, codecs and feature packages. Target-size compression, fallback cascade, plugin registry and processing reports.

> Status: Phase 1 implemented — easy mode `processImage` (defaults + fallback cascade + report), fluent `pipeline()` with single-pass canvas merging and positional plugin steps, and `processBatch()` (bounded concurrency, per-item overrides, errors as values, progress events). Real-browser tests in `tests/browser/image.spec.ts`.
>
> Plugin API stabilised in Phase 5 (ADR-0007): easy mode runs `options.plugins` too (they were silently dropped before), a codec can be registered and selected as the output format via `options.codecs` + `format`, plugin steps declare their output MIME type, and plugin failures surface as typed errors (`plugin-failed`). See docs/API_DESIGN.md section 6.
