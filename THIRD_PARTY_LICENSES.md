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
| libaom | `@dusrel/image-avif` | BSD 2-Clause + patent grant |
| Rust `png` crate | `@dusrel/image-png` | MIT / Apache-2.0 |
| OxiPNG | `@dusrel/image-oxipng` | MIT |
| `resize`, `hqx`, magic-kernel | `@dusrel/image-resize` | MIT / Apache-2.0 |
| libjxl | `@dusrel/image-jxl` | BSD 3-Clause |
| libimagequant | `@dusrel/image-quantize` | BSD 2-Clause (GPL/commercial dual for some uses — verify before release) |
| gifsicle | `@dusrel/image-gif` | GPL-2.0 — **distribution review required before release** |
| SVGO | `@dusrel/image-svg` | MIT |
| wasm-feature-detect (dev/runtime helper in codec packages) | codec packages | Apache-2.0 |
| Squoosh / jSquash (reference & codec packaging) | — | Apache-2.0 |

## Open licence actions (must be closed before first public release)

1. Confirm libimagequant terms for the intended distribution model.
2. Decide gifsicle strategy (GPL implications) or replace with a permissive
   GIF optimiser.
3. Generate full licence texts automatically in the WASM build workflow and
   ship them inside each codec package.
