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

> Status: **complete (2026-11-08)** — all six feature packages
> implemented and verified in real browsers on CI (Chromium,
> Firefox, WebKit), 135 unit tests repo-wide: `-transform`
> (4d82f8b), `-adjust` (a1d2aa7), `-metadata` (6ee62cd), `-watermark`
> (25444b7), `-batch` (b1bf677), `-crop` (e3ac046). The playground
> (`apps/playground`) wires every feature together — crop
> component, metadata inspector, pipeline with adjust/watermark
> plugins, canvas + WASM codec formats, batch demo — and
> `examples/` carries vanilla, React, Vue, Next, Nuxt and CDN
> mini-examples. Three real bugs were caught by the browser
> suite during this phase and fixed: structural PixelData
> rejected by canvas putImageData, rotate bounds clipping
> (round → ceil), and Chromium hanging on module workers from
> blob URLs (the batch pool gained a caller-chosen worker type).

## Phase 4 — Framework wrappers & docs site
- `@dusrel/image-react`, `-vue`, `-svelte`; docs site (VitePress) with
  TypeDoc API reference; CDN usage example

> Status: **complete (2026-11-08)** — all three framework wrappers
> implemented inside this monorepo (`packages/frameworks/`) and the
> docs site built in `apps/docs-site`; 152 unit tests repo-wide,
> every suite green on GitHub (CI, CodeQL, Browser tests, Docs):
> `-react` (55151a9, fix ddb6be0), `-vue` (55405c2), `-svelte`
> (3e56ff4, fixes 30f0fb4 + 6b8c960), docs site (a010559).
> All three wrappers share one design: a framework-free,
> subscribable processor store (status/step/progress/result/error,
> composed AbortSignals, supersede/abort/reset, injectable process
> functions) bridged idiomatically per framework — React hooks
> (`useSyncExternalStore`) + a forwardRef crop component, Vue
> composables (`shallowRef` + computeds) + a v-model crop
> component, Svelte store factories (writable + derived) + a runes
> crop component shipped as `.svelte` source with `bind:crop`.
> Each crop wrapper registers `<dusrel-crop>` lazily (SSR-safe
> imports) and each package is proven by a real mounted fixture
> app in Chromium, Firefox and WebKit. Browser verification caught
> three real bugs, all fixed: the React fixture needed a
> `NODE_ENV` define (React's CJS entry reads `process.env`); the
> Svelte fixture resolved `svelte` to its server entry, where
> `mount` is an unavailable stub (fixture builds need
> `platform: "browser"`); and Safari never upgrades
> template-parsed custom elements, so the Svelte component
> creates its element imperatively via `document.createElement`.
> The docs site is VitePress: guide pages `@include` the `docs/`
> sources (single source of truth), TypeDoc generates the API
> reference for all 19 public entry points into `/api/`, and the
> Docs workflow now builds the full site as a CI gate. The CDN
> usage example shipped with Phase 3 (`examples/cdn`).
> Next: Phase 5 — experimental packages (jxl, qoi, gif, svg),
> plugin API stabilisation, HEIC decode and placeholder
> investigations.

## Phase 5 — Experimental & plugins
- `@dusrel/image-jxl`, `-qoi`, `-gif`, `-svg` (subject to licence decisions)
- Plugin API stabilisation; HEIC decode plugin investigation;
  placeholder (blurhash-style) plugin investigation

> Status: **complete (2026-11-08)** — every Phase 5 item shipped
> and verified on GitHub (CI, CodeQL, Browser tests, Docs all
> green, three engines): `@dusrel/image-qoi` (8010ef0, Rust qoi
> crate, pixel-exact + hand-built RGB fixture),
> `@dusrel/image-jxl` (0d27357, libjxl v0.11.2 against the
> public C API; lossless needed `uses_original_profile`
> root-caused in libjxl's encoder), `@dusrel/image-gif`
> (b58f3cf, Rust gif crate, stacked-frame global palette),
> `@dusrel/image-svg` (ff1f37a, SVGO wrapper; the browser spec
> renders via `<img>` — createImageBitmap rejects SVG blobs in
> all engines), plugin API stabilisation (01275e6, ADR-0007:
> easy-mode plugins actually run, codecs register as output
> formats, typed `plugin-failed` errors) and
> `@dusrel/image-placeholder` (ed5546b, ADR-0009: ThumbHash +
> BlurHash from spec in pure TypeScript, oracle vectors pinned
> against the reference packages). Repo at 458 files, 204 unit
> tests, 23 lockstep packages.
> The HEIC investigation is complete (ADR-0008): libheif +
> libde265 are LGPL-3.0 and no permissive HEVC decoder exists,
> so `@dusrel/image-heic` ships only if that licence exception
> is accepted (options A/B/C in the ADR; recommendation A —
> decode-only, native-first). The placeholder investigation
> became a shipped package rather than a spike because both
> algorithms are MIT (ADR-0009).
> ADR-0008 was decided the same day: Dus chose Option A, and
> `@dusrel/image-heic` shipped on top of this phase
> (libheif v1.23.7 + libde265 1.0.15, decode-only,
> native-first; engine LGPL-3.0, wrapper MIT).
> Open: a first npm release via Changesets (org `dusrel`
> exists, nothing published yet).

## Later / explicitly not v1
- Client-side AI plugins (e.g. background removal with on-device models) —
  optional plugins only, never a backend dependency
