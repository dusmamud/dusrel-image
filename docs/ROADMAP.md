# Roadmap: dusrel-image

## Phase 0 — Foundation (documentation & skeleton)
- [x] Research (Exa cross-verified) and locked decisions (PRD/TRD/ADRs)
- [x] Repository skeleton and all required docs
- [x] npm scope `@dusrel` ownership confirmed (npm org `dusrel`, 2026-11-07)
- [x] CI workflows created (ci, browser-tests, wasm-build, benchmarks,
      release, docs, codeql + Dependabot) and branch protection on
- [x] Root tooling: pnpm workspaces, Turborepo, TypeScript base config,
      tsdown per package, size-limit budgets wired (empty packages)

## Phase 1 — Core & pipeline (no WASM yet)

> Status: **complete (2026-11-07)** — `@dusrel/image-core` (ea07b92),
> `@dusrel/image` (d6aa024) and the batch queue all implemented,
> unit-tested and verified in real browsers on CI (Chromium, Firefox,
> WebKit). Metadata strip is inherent to Canvas re-encode.
- `@dusrel/image-core`: decode, Canvas engine, worker runtime, errors, types
- `@dusrel/image`: easy mode + fluent pipeline, target-size strategy,
  fallback cascade, report
- Features on Canvas: resize, crop-by-coordinates, rotate/flip, convert
  (JPEG/WebP/PNG), metadata strip, batch queue

## Phase 2 — WASM codecs (jSquash model)

> Status: **complete (2026-11-07)** — all seven packages implemented
> and verified in real browsers on CI (Chromium, Firefox, WebKit),
> every module gated by a functional smoke test inside its Docker
> build and re-verified locally before commit: `-jpeg` (MozJPEG,
> 89a6ddb), `-webp` (libwebp, 3c1f4b4), `-avif` (libaom + libavif,
> bfaca68), `-png` (Rust png crate, e6c9d89), `-oxipng` (22b3ff1),
> `-resize` (fbe7904), `-quantize` (quantizr, d4a1bb9). Pipeline
> codec registration (`codecPlugin` / `imageDataPlugin` in
> `@dusrel/image`) closed the phase (dcb0422). Tracked optimisations
> that do NOT block the phase: MozJPEG encoder size tuning, a slim
> dav1d-based AVIF decoder, and hqx for `-resize` (not present in
> the resize crate; see CODEC_GUIDE).
- `@dusrel/image-jpeg`, `-webp`, `-avif`, `-png`, `-oxipng`, `-quantize`,
  `-resize` — each separately installable and lazy-loaded
- Docker WASM build workflow live; attribution generation live

## Phase 3 — Feature packages
- `@dusrel/image-crop` (accessible Web Component UI), `-transform`,
  `-adjust`, `-metadata` (EXIF read/preserve), `-watermark`, `-batch`
  (worker pool), playground with all features, examples for each framework

## Phase 4 — Framework wrappers & docs site
- `@dusrel/image-react`, `-vue`, `-svelte`; docs site (VitePress) with
  TypeDoc API reference; CDN usage example

## Phase 5 — Experimental & plugins
- `@dusrel/image-jxl`, `-qoi`, `-gif`, `-svg` (subject to licence decisions)
- Plugin API stabilisation; HEIC decode plugin investigation;
  placeholder (blurhash-style) plugin investigation

## Later / explicitly not v1
- Client-side AI plugins (e.g. background removal with on-device models) —
  optional plugins only, never a backend dependency
