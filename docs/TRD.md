# TRD — Technical Requirements Document: dusrel-image

- Version: 1.0 (locked, 2026-11-07)
- Companion to: PRD.md, ARCHITECTURE.md, API_DESIGN.md

## 1. Architecture (locked)

Two layers, mirroring jSquash's model (ADR-0001):

- **Layer A — Native core (tiny):** TypeScript, zero runtime dependencies.
  `createImageBitmap` + `OffscreenCanvas`/Canvas 2D + `convertToBlob`/`toBlob`,
  executed in a Web Worker when available. Handles compress (quality),
  resize, crop (by coordinates), rotate, flip and JPEG/WebP/PNG conversion.
- **Layer B — WASM codec sub-packages:** one npm package per codec/tool,
  exactly in jSquash's spirit: separately installable, encode and decode as
  separate entries, ESM-only, lazy-loaded WASM, worker-ready.
  Engines: MozJPEG, libwebp, libavif+libaom, Rust PNG crate, OxiPNG,
  a permissive Rust quantizer, resize/hqx/magic-kernel,
  libjxl (experimental), QOI.
- **Feature sub-packages** sit on top: crop UI, transform, adjust, metadata,
  watermark, batch, gif, svg, and framework wrappers (react/vue/svelte).

Hard rule: **no codec WASM is ever bundled into the core or the main package.**

## 2. Languages & build (locked, ADR-0004)

- Own code: TypeScript (strict) throughout; JavaScript is build output only.
- C/C++ codecs compiled with **Emscripten**; Rust codecs with
  **cargo + the wasm-bindgen CLI** (pinned to the crate version);
  native builds run only inside pinned Docker images (WASM_BUILD.md).
- New WASM modules: Rust-first; C/C++ only where the upstream library is C/C++.
- Package build: **tsdown** (Rolldown). Apps (playground, docs): Vite.
- Monorepo: pnpm workspaces + Turborepo. Releases: Changesets, lockstep
  versioning across all `@dusrel/image-*` packages.

## 3. Module & packaging requirements

- ESM-only. Correct `exports` maps with subpath entries; `sideEffects: false`.
- Tree-shakeable: importing one function must not pull codecs or UI.
- Every package passes `publint` and `attw --pack` in CI.
- WASM assets are versioned, immutable, loaded relative to `import.meta.url`,
  with a developer-overridable asset base URL (for CDN deployments).
- Vite consumers need `optimizeDeps.exclude` for codec packages — this must be
  documented in every codec README.

## 4. Runtime behaviour requirements

- **Fallback cascade:** Worker + OffscreenCanvas -> main-thread Canvas ->
  WASM where Canvas cannot do the job (e.g. AVIF encode). Feature detection
  only; never user-agent sniffing. Known quirk handling: e.g. Safari may
  silently return PNG for WebP canvas encodes — detect by result MIME.
- **Threading:** single-threaded WASM by default. Multi-threaded variants are
  opt-in and require cross-origin isolation (COOP/COEP +
  SharedArrayBuffer); packages must never require them.
- **AVIF defaults:** speed pinned to 9 by default (documented tradeoff:
  lower speeds are unusably slow single-threaded on large photos).
- **Memory:** every ImageBitmap is closed; object URLs are revoked; worker
  pool is bounded; oversized inputs beyond canvas/platform limits produce a
  typed error, not a page crash.
- **Cancellation & progress:** every long operation accepts AbortSignal and
  reports progress where the underlying step allows it.
- **No network:** no telemetry, no analytics, no remote config. The only
  fetches allowed are the package's own WASM assets.
- **CSP:** no `eval` / dynamic code execution anywhere.

## 5. Performance & size budgets (enforced by size-limit in CI)

| Artifact | Budget (gzip) |
| --- | --- |
| `@dusrel/image-core` | <= 10 KB |
| `@dusrel/image` (pipeline, no codecs) | <= 15 KB |
| Each feature package | <= 10 KB (crop UI <= 20 KB) |
| Codec JS glue (per codec) | <= 10 KB (WASM counted separately, lazy) |

Benchmark targets and method: PERFORMANCE.md.

## 6. Browser support

Baseline and fallbacks are defined in BROWSER_SUPPORT.md. In short: current
Chrome/Edge, Firefox and Safari (16.4+) with graceful degradation to
main-thread Canvas on older engines.

## 7. Testing requirements

See TESTING.md. Key point: the maintainer's local machine is NOT the source of
truth for browser behaviour. GitHub Actions (unit + Playwright matrix across
Chromium, Firefox, WebKit) is. No release ships on local-only verification.

## 8. Security requirements

See SECURITY.md and the security section of ARCHITECTURE.md: decoders treat
input as hostile; codec versions pinned; reproducible Docker builds;
Dependabot + CodeQL in CI; npm publishing via OIDC trusted publishing with
provenance (no long-lived npm tokens).

## 9. Open technical risks

- R1: CLOSED (2026-11-07) — npm org `dusrel` created by Dus; `@dusrel`
  scope ownership verified against the npm registry.
- R2: CLOSED (2026-11-07) — libimagequant and gifsicle dropped on licence
  grounds; permissive replacements chosen (THIRD_PARTY_LICENSES.md).
- R3: Safari OffscreenCanvas-in-worker flakiness — cascade must be tested on
  WebKit in CI, not assumed.
- R4: AVIF encode time on low-end mobiles — mitigated by speed default,
  progress + cancellation, and documented guidance.
