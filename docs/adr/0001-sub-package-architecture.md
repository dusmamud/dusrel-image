# ADR-0001: Sub-package architecture modelled on jSquash
- Status: Accepted (2026-11-07)

## Context
One monolithic package would force every user to download every codec
(including the ~3 MB AVIF WASM) and would couple UI, codecs and pipeline
into one release unit. jSquash proved the alternative works.

## Decision
Every codec and tool is its own npm package under `@dusrel/`
(e.g. `@dusrel/image-jpeg`), separately installable, with encode/decode as
separate entries, ESM-only, lazy-loaded WASM, worker-ready. A main
`@dusrel/image` package composes them. No codec WASM is ever bundled into
the core or main package.

## Consequences
More packages to build/test/release (mitigated by monorepo tooling and
lockstep versioning, ADR-0005), in exchange for tiny installs, clean
tree-shaking and independent codec lifecycles.
