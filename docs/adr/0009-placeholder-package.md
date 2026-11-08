# ADR-0009: Placeholder package — ThumbHash + BlurHash, pure TypeScript

- Status: Accepted (2026-11-08)

## Context

Phase 5's scope included a "blurhash-style placeholder"
investigation: a compact string that renders as a blurred
preview while the real image loads. Two algorithms dominate,
and the investigation (Exa cross-verified, 2026-11-08) found
no reason to pick only one.

## Findings

- **BlurHash** (Wolt, 2019) — **MIT**. DCT-based, encodes to
  a 20–30 character Base83 string. Component counts are
  configurable (4×3 typical). Does **not** encode the aspect
  ratio (callers must store width/height separately) and
  does not preserve alpha. Widest adoption and interop:
  existing BlurHash strings in the wild (Mastodon, Signal)
  only a BlurHash decoder can render.
- **ThumbHash** (Evan Wallace, 2023) — **MIT**. ~25–35 byte
  hashes (base64). Encodes **more detail per byte**, more
  accurate colours, the **aspect ratio**, and an **alpha
  channel**. No configurable parameters (by design).
- Both are small, well-specified pure-math algorithms
  (DCT + quantisation). Neither needs WASM, a native engine,
  or a runtime dependency: a from-spec TypeScript
  implementation is a few hundred lines, unit-testable in
  Node against published test vectors.
- The family's "maximum features, maximum control" rule
  applies: BlurHash's configurability and interop plus
  ThumbHash's fidelity/alpha/aspect coverage are
  complementary, not competing.

## Decision

Ship **`@dusrel/image-placeholder`** as a pure-TypeScript
feature package on the Phase 3 `PixelData` convention:

- `encodeThumbHash(data)` / `decodeThumbHash(hash)` —
  bytes ⇄ `PixelData`; decode also yields the encoded
  aspect ratio.
- `encodeBlurHash(data, componentX?, componentY?)` /
  `decodeBlurHash(hash, width, height)` — string ⇄
  `PixelData`, components defaulting to the recommended
  4×3 (adjusted by aspect).
- Helpers: `averageColor(data)` (the DC term — a solid
  colour placeholder with zero decoding), and decode
  helpers returning `ImageData`-ready pixels for
  `imageDataPlugin` composition in `@dusrel/image`.
- Encoders downscale internally before the DCT (the
  algorithms discard fine detail anyway); the maximum
  input dimension is an option, not a hidden constant.
- No dependencies, no WASM, no codec assets. Package stays
  MIT like every other feature package.

## Consequences

- New scaffold package folder under `packages/features/`
  joins the Changesets lockstep group (23 packages) when
  implemented.
- Browser spec proves decode output renders and matches
  reference vectors on all three engines; unit tests pin
  the published BlurHash/ThumbHash example hashes.
