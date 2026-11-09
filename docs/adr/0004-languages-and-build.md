# ADR-0004: Languages and build toolchain
- Status: Accepted (2026-11-07)

## Context
The family must be tiny, tree-shakeable, type-safe and publishable by one
maintainer with many packages.

## Decision
- Own code: TypeScript (strict) everywhere; ESM-only output.
- C/C++ codecs: Emscripten. Rust codecs: wasm-pack. Native builds only in
  pinned Docker images.
- New WASM modules: Rust-first.
- Package builds: tsdown (Rolldown). Apps: Vite.
- Monorepo: pnpm workspaces + Turborepo. Lint/format: oxlint + oxfmt.
- Tests: Vitest + Playwright. Package gates: publint, attw, size-limit.

## Consequences
tsup is not used (unmaintained; tsdown is its Rolldown-based successor).
Node version is pinned repo-wide so builds are reproducible.

> **Addendum (2026-11-09):** the Rust pipeline is implemented with plain
> `cargo build --target wasm32-unknown-unknown` + the wasm-bindgen CLI
> (version pinned to the crate's) rather than the wasm-pack wrapper —
> one less moving part, same output. The decision's substance (Rust
> codecs compiled via wasm-bindgen, reproducibly, inside Docker) is
> unchanged.
