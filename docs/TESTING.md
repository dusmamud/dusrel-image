# Testing Strategy: dusrel-image

## The honest constraint

The maintainer's local development machine (a Linux VM) can run builds,
typechecks and unit tests, and a headless Chromium. It **cannot** reliably
reproduce: real Safari/WebKit behaviour on macOS/iOS, Firefox vs Chromium
codec differences, mobile GPUs and SIMD paths, cross-origin-isolation
conditions, or real CDN/caching behaviour.

**Therefore GitHub Actions is the source of truth, not local runs.**
No release may ship on local-only verification.

## Layers

1. **Unit tests (Vitest):** option validation, pipeline planning, geometry
   (crop/rotate maths), target-size strategy, error mapping, metadata rules.
2. **Package tests:** every package's packed tarball is tested (not just its
   sources): exports resolve, types are correct (`attw`, `publint`),
   tree-shaking works, size budgets hold (`size-limit`).
3. **Browser tests (Playwright, in CI):** Chromium, Firefox and WebKit run
   the real pipeline on corpus images: decode -> transform -> encode,
   verifying output MIME, dimensions, byte ranges and visual similarity
   (pixelmatch with documented thresholds).
4. **WASM build tests:** codecs built in Docker are smoke-tested in the same
   browser matrix before artifacts are accepted.
5. **Benchmarks:** scheduled and on relevant PRs (see PERFORMANCE.md).
6. **Manual device pass (pre-release checklist):** at least one real iPhone
   (Safari) and one mid-range Android (Chrome) run through the playground:
   large photo, AVIF, batch of 10, cancellation, background-tab behaviour.

## CI workflows (all created before feature code, see RELEASE.md)

- `ci.yml` — lint, typecheck, unit, build, publint/attw, size-limit (per PR)
- `browser-tests.yml` — Playwright matrix (per PR + nightly)
- `wasm-build.yml` — native codec builds in Docker (on native changes)
- `benchmarks.yml` — perf/size comparison comments (on processing PRs)
- `release.yml` — Changesets version PR + npm publish with provenance
- `docs.yml` — docs site build/deploy
- `codeql.yml` + Dependabot — security scanning and dependency updates
- Nightly scheduled run against latest browsers to catch upstream breakage

Branch protection: `main` requires the CI and browser-test workflows to pass.
