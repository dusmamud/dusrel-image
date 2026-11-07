# ADR-0006: Single-threaded WASM by default
- Status: Accepted (2026-11-07)

## Context
Multi-threaded WASM needs SharedArrayBuffer, which needs cross-origin
isolation (COOP/COEP response headers). Most consuming sites cannot set
those headers (they break ads, embeds and third-party iframes), so making
threading the default would break the packages for most developers.

## Decision
All codecs run single-threaded by default. Multi-threaded artifacts are
shipped separately and activated only when the developer explicitly opts in
and their page is cross-origin isolated.

## Consequences
Slightly slower peak encode speeds (notably AVIF — mitigated by the
speed-9 default, progress and cancellation) in exchange for working
everywhere with zero deployment requirements.
