# @dusrel/image-jxl

JPEG XL codec (libjxl v0.11.2, WASM, lazy-loaded). Separate
encode/decode entries; the WASM is never bundled into any other
package.

> **EXPERIMENTAL:** browser JPEG XL decode support is still limited;
> use only where you control the viewing environment. This package
> exists so your app can *produce* and *read* JXL regardless of
> native browser support.

```ts
import { encode, decode } from "@dusrel/image-jxl";

const bytes = await encode(imageData, { quality: 85, effort: 7 });
const lossless = await encode(imageData, { lossless: true });
const pixels = await decode(bytes); // ImageData
```

Options: `quality` 0..100 (default 85, mapped to a butteraugli
distance by libjxl's own `JxlEncoderDistanceFromQuality`),
`lossless` (default false), `effort` 1..10 (default 7).
Encoding is sRGB-in/sRGB-out (`uses_original_profile` — required by
libjxl for lossless). Output is a bare JXL codestream
(`FF 0A` signature).

Single-threaded by construction (ADR-0006): the glue sets libjxl's
NULL parallel runner, so no SharedArrayBuffer and no COOP/COEP
headers are ever required.

Artifact sizes (built by the `wasm-build` workflow from
`native/jxl`, functionally smoke-gated in Docker and re-verified
locally before commit): encoder 2,404,041 B, decoder 905,079 B.

Engine licence: BSD 3-Clause (bundled brotli BSD 3-Clause, highway
Apache-2.0, skcms BSD-style) — see THIRD_PARTY_LICENSES.md.
