# Third-party licences

dusrel-image's own TypeScript code is MIT licensed (see `LICENSE`). The WASM
codec sub-packages wrap native libraries that keep their own licences. The
authoritative, per-release attribution (exact versions + full licence texts)
is generated at build time; this file records the standing list.

| Component | Used by | Licence |
| --- | --- | --- |
| MozJPEG | `@dusrel/image-jpeg` | IJG licence / BSD-style (zlib-based) |
| libwebp | `@dusrel/image-webp` | BSD 3-Clause |
| libavif | `@dusrel/image-avif` | BSD 2-Clause |
| png (Rust crate) | `@dusrel/image-png` | MIT OR Apache-2.0 |
| oxipng (Rust crate) | `@dusrel/image-oxipng` | MIT |
| resize (Rust crate) | `@dusrel/image-resize` | MIT |
| quantizr (Rust crate) | `@dusrel/image-quantize` | MIT |
| qoi (Rust crate) | `@dusrel/image-qoi` | MIT OR Apache-2.0 |
| gif (Rust crate) | `@dusrel/image-gif` | MIT OR Apache-2.0 |
| color_quant (Rust crate) | `@dusrel/image-gif` (quantiser inside the `gif` crate) | MIT |
| rgb (Rust crate) | `@dusrel/image-resize` (pixel types) | MIT |
| wasm-bindgen | all Rust codec packages | MIT OR Apache-2.0 |
| libaom | `@dusrel/image-avif` | BSD 2-Clause + patent grant |
| Rust `png` crate | `@dusrel/image-png` | MIT / Apache-2.0 |
| OxiPNG | `@dusrel/image-oxipng` | MIT |
| `resize`, `hqx`, magic-kernel | `@dusrel/image-resize` | MIT / Apache-2.0 |
| libjxl | `@dusrel/image-jxl` | BSD 3-Clause |
| brotli, highway, skcms (libjxl's bundled deps) | `@dusrel/image-jxl` | brotli BSD 3-Clause; highway Apache-2.0; skcms BSD-style (Skia) |
| libimagequant | — (not used) | GPL-3.0-or-later for FLOSS use; commercial licence required for closed-source/AppStore use — see pngquant.org/lib. **Dropped by decision on 2026-11-07**: `@dusrel/image-quantize` uses a permissive quantizer instead, keeping the package MIT. |
| gifsicle | — (not used) | GPL-2.0-only; closed-source use requires the author's permission. **Dropped by decision on 2026-11-07**: `@dusrel/image-gif` uses a permissive Rust `gif`-crate based optimiser/encoder instead, keeping the package MIT. |
| SVGO | `@dusrel/image-svg` | MIT |
| ThumbHash algorithm (Evan Wallace) | `@dusrel/image-placeholder` (from-spec TypeScript implementation; no code dependency) | MIT |
| BlurHash algorithm (Wolt) | `@dusrel/image-placeholder` (from-spec TypeScript implementation; no code dependency) | MIT |
| wasm-feature-detect (dev/runtime helper in codec packages) | codec packages | Apache-2.0 |
| Squoosh / jSquash (reference & codec packaging) | — | Apache-2.0 |

## Open licence actions (must be closed before first public release)

1. CLOSED (2026-11-07): libimagequant is not used. `@dusrel/image-quantize`
   ships a permissive quantizer (exact crate pinned during the Phase 3 codec
   work), so the package stays MIT.
2. CLOSED (2026-11-07): gifsicle is not used. `@dusrel/image-gif` ships a
   permissive Rust `gif`-crate based optimiser/encoder, so the package
   stays MIT.
3. Generate full licence texts automatically in the WASM build workflow and
   ship them inside each codec package.
