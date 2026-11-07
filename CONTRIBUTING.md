# Contributing to dusrel-image

Thank you for helping build dusrel-image. This project is documentation-first:
the locked decisions in `docs/` and `docs/adr/` govern all contributions.

## Before you start

1. Read `docs/PRD.md`, `docs/TRD.md` and `docs/API_DESIGN.md`.
2. Read the ADRs in `docs/adr/`. If your change contradicts an ADR, open an
   issue proposing a new ADR first — do not silently diverge.
3. Check that your change respects the non-negotiables: no backend, no network
   calls, no WASM in the core, single-thread default, per-package size budgets.

## Development setup (planned toolchain)

- Node.js (pinned version for the whole repo) and pnpm (workspaces)
- Turborepo runs builds/tests in dependency order with caching
- TypeScript (strict) everywhere; ESM only
- Build per package: tsdown (Rolldown). Playground/docs: Vite
- Lint/format: oxlint + oxfmt. Tests: Vitest (unit) and Playwright (browsers)

## Pull requests

- One concern per PR. Keep public API changes out of unrelated PRs.
- Every PR that changes a package needs a **Changeset** describing the change.
- CI must pass: lint, typecheck, unit tests, build, publint, attw (Are The
  Types Wrong) and size-limit budgets. Browser tests (Chromium/Firefox/WebKit)
  must pass for processing changes.
- Conventional Commits are used for messages.
- Update the affected package README and any `docs/` file your change touches.

## Test images

Only add test images to `benchmarks/corpus/` if they are licence-free or your
own work, and note the source in `benchmarks/corpus/README.md` when it exists.

## Code of conduct

Participation is governed by `CODE_OF_CONDUCT.md`.
