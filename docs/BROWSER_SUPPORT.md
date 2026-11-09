# Browser Support: dusrel-image

## Baseline

| Capability | Chrome/Edge | Firefox | Safari |
| --- | --- | --- | --- |
| Canvas 2D + toBlob (fast path) | yes | yes | yes |
| createImageBitmap (in worker) | yes | yes | yes (widely available) |
| OffscreenCanvas in worker | yes | yes (105+) | 16.4+, with quirks |
| WebP encode via canvas | yes | yes | 17+ (older may silently return PNG) |
| AVIF encode via canvas | Chromium 130+ only | no | no |
| HEIC decode | no (WASM fallback) | no (WASM fallback) | 17+ native |
| WebCodecs ImageDecoder | yes | no | no |
| SharedArrayBuffer (multi-thread WASM) | with COOP/COEP | with COOP/COEP | with COOP/COEP |

Figures are the cross-verified research baseline (Nov 2026) and must be
re-checked in CI against the Playwright matrix before each release.

**Verified for 1.0.0:** the Playwright matrix (Chromium, Firefox,
WebKit) runs every package's browser spec and was green on the release
head; the consumer test additionally exercised the published packages
in a real Vite build. Safari's HEIC support is why
`@dusrel/image-heic` probes native decode first and only downloads its
WASM engine where the probe fails.

## Rules

1. **Feature-detect, never UA-sniff.** Every capability above is probed at
   runtime (including inside the worker).
2. **Verify encode results.** A canvas encode is accepted only if the
   returned Blob's MIME matches the request; otherwise the documented
   fallback runs (this catches Safari's silent-PNG behaviour).
3. **Cascade:** worker + OffscreenCanvas -> main-thread Canvas -> WASM codec
   (e.g. AVIF always goes WASM except Chromium-native where selected).
4. **WebCodecs is not a dependency.** ImageDecoder may accelerate animated
   formats where present, but there is no ImageEncoder; no feature may
   require WebCodecs.
5. **Minimum supported:** Safari 16.4+ for the worker path; older browsers
   get the main-thread path with a recorded fallback in the report.
6. Known quirks (Safari module-worker OffscreenCanvas flakiness, iOS
   background-tab worker pausing, per-browser canvas size limits) are
   handled in the cascade and covered by WebKit CI tests.
