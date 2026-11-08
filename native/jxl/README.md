# native/jxl

Reproducible WASM build for `@dusrel/image-jxl`: libjxl
**v0.11.2** (BSD-3-Clause) compiled with Emscripten SDK 3.1.66,
glued through the public C API (`lib/include/jxl/encode.h`,
`decode.h`) by our own wrappers in `wrapper/`.

Single-threaded, non-SIMD artifacts: the glue never installs
a parallel runner, so no SharedArrayBuffer or COOP/COEP
headers are needed (ADR-0006). Only three submodules are
fetched — brotli, highway, skcms (the default colour
management in v0.11). The Docker build ends with a functional
smoke gate (`smoke.mjs`): a pixel-exact lossless roundtrip
plus a tolerance-checked lossy one must pass before any
artifact leaves the build.

Provenance: the build recipe follows the same shape as this
repo's other C codecs; libjxl-specific choices (submodule
set, skcms, deprecated-SIMD warning suppression) cross-check
against the Squoosh/jSquash build, which ships the same
library to production.
