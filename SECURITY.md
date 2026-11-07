# Security policy

## Reporting a vulnerability

Please report security issues **privately** to the project owner via GitHub's
"Report a vulnerability" (private vulnerability reporting) on this repository.
Do not open a public issue for a vulnerability. We aim to acknowledge reports
within 7 days.

## Security model of the packages

- All image processing happens **client-side**. The packages contain no
  telemetry and make no network requests, except loading their own versioned
  WASM assets from the same origin/CDN the developer deployed them to.
- WASM codecs run single-threaded by default and use no dynamic code
  execution (`eval` / `new Function`), so the packages are compatible with
  strict Content Security Policies.
- Image data is untrusted input. Decoders are treated as an attack surface:
  codec libraries are pinned, rebuilt reproducibly in Docker (see
  `docs/WASM_BUILD.md`), and kept updated via Dependabot and scheduled CI.
- Known limits (maximum canvas size, decompression bombs, oversized images)
  are enforced as documented in `docs/TRD.md`; exceeding them produces a
  typed error, never a silent crash of the host page where avoidable.

## Supported versions

Security fixes are applied to the latest released version of each
`@dusrel/image-*` package. All packages are versioned in lockstep.
