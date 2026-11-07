# ADR-0003: Build the family from scratch; reuse proven codec engines
- Status: Accepted (2026-11-07) — confirmed by project owner

## Context
"From scratch" is ambiguous. Writing JPEG/AVIF encoders from scratch is a
multi-year research effort; even jSquash did not do it — it packages
Squoosh's builds of MozJPEG, libwebp, libavif and Rust codecs.

## Decision
dusrel-image is built from scratch in everything that is *ours*: core,
pipeline, API, sub-package glue, features, tests, benchmarks and docs.
The native codec *engines* (MozJPEG, libwebp, libavif+libaom, Rust PNG
crate, OxiPNG, resize/hqx/magic-kernel, libimagequant, libjxl) are compiled
to WASM and reused under their licences, with full attribution
(NOTICE, THIRD_PARTY_LICENSES.md).

## Consequences
Server-grade quality from day one; licence obligations must be tracked and
closed before release. Any future home-grown codec work starts as a Rust
module (ADR-0004), never as a rewrite of an existing engine.
