# ADR-0002: No backend — client-side only, forever
- Status: Accepted (2026-11-07)

## Context
Server-side image processing costs money, adds latency and uploads users'
private photos. The product's core promise is the opposite.

## Decision
The packages perform all processing in the browser and make no network
calls except loading their own WASM assets. There is no dusrel server,
API, telemetry or account system. Saving/uploading the processed image is
the consuming app's responsibility, outside this project.

## Consequences
Zero operating cost and a strong privacy story. Features that would need a
server (cloud AI etc.) are out of scope or must be optional on-device
plugins.
