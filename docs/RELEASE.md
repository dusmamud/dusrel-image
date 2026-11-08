# Release Process: dusrel-image

## Versioning

- Semantic versioning; **all `@dusrel/image-*` packages share one version
  (lockstep)** and release together.
- Changes are recorded with **Changesets**: every PR affecting a package
  includes a changeset (patch/minor/major + summary).

## Flow

1. PRs merge to `main` with changesets (CI + browser tests green, branch
   protection enforced).
2. The Changesets GitHub Action maintains a "Version Packages" PR that
   bumps versions and changelogs.
3. Merging the Version PR triggers `release.yml`, which runs the same
   Changesets action in publish mode: builds all packages
   (`turbo run build`) and publishes to npm with **provenance
   attestations** (OIDC, `id-token: write`). Authentication: npm
   cannot create a package via trusted publishing, so the **first**
   publish of the family was bootstrapped with a granular access
   token (repo secret `NPM_TOKEN`, scoped to `@dusrel` only,
   bypass-2FA enabled, 90-day expiry). Migrating every package to
   trusted publishing and revoking the token is the recorded
   follow-up hardening.
4. The action pushes a git tag per package (`@dusrel/<pkg>@<version>`)
   after a successful publish.

## Pre-release checklist

- [x] npm scope `@dusrel` ownership confirmed — npm org `dusrel`, registry-verified 2026-11-07
- [x] Open licence items in THIRD_PARTY_LICENSES.md closed (2026-11-07)
- [x] Browser matrix green (Chromium/Firefox/WebKit) on the release commit — via Version PR #10's checks (identical package tree), 2026-11-08
- [ ] Benchmarks show no unexplained regression
- [ ] Manual device pass done (TESTING.md)
- [x] Docs and per-package READMEs updated; migration guide if major — Vite codec-asset guide added after the consumer test (see below)

## First release — 1.0.0 (2026-11-08)

All 24 packages published to npm at **1.0.0** via Changesets:
release wiring commit `bbe7229`, Version PR #10 (merged as
`dee7a40`), publish run green, 24 git tags pushed, and every package
independently verified on the registry (packument, version doc,
tarball, provenance attestation). npm's registry replication lagged
~25 minutes behind the bulk first publish (404s on packuments and
some tarballs) before settling — expected behaviour, not a failed
publish.

Post-release verification (same day): a separate React + Vite
consumer project (`~/workspace/dusrel-consumer-test`, outside this
repo) installed the published packages from the registry — 43/43
pack-smoke checks passed (real codec roundtrips, EXIF GPS parse,
feature packages, React store), the Vite production build emitted
and served all codec assets correctly, and one real consumer issue
was found and documented: Vite's dev pre-bundling breaks the codec
loaders' default asset URLs. Both verified fixes (optimizeDeps
exclusion, `setCodecAssets` with `?url` imports) are documented in
the Quickstart's "WASM codecs with Vite" section. Benchmarks and the
manual device pass were not run as gates for 1.0.0 and stay open
above.

## Scoped-package publishing note

Scoped packages are private by default on npm; the first publish of every
`@dusrel/*` package must be explicitly public. The release workflow sets
public access for all packages.
