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
3. Merging the Version PR triggers `release.yml`: builds all packages,
   re-runs publint/attw and size-limit, and publishes to npm using **OIDC
   trusted publishing with provenance** — no long-lived npm tokens are
   stored anywhere.
4. A GitHub Release is created with the generated notes.

## Pre-release checklist

- [x] npm scope `@dusrel` ownership confirmed — npm org `dusrel`, registry-verified 2026-11-07
- [x] Open licence items in THIRD_PARTY_LICENSES.md closed (2026-11-07)
- [ ] Browser matrix green (Chromium/Firefox/WebKit) on the release commit
- [ ] Benchmarks show no unexplained regression
- [ ] Manual device pass done (TESTING.md)
- [ ] Docs and per-package READMEs updated; migration guide if major

## Scoped-package publishing note

Scoped packages are private by default on npm; the first publish of every
`@dusrel/*` package must be explicitly public. The release workflow sets
public access for all packages.
