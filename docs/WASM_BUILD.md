# WASM Build Guide: dusrel-image

Native codecs are built **only** inside pinned Docker images, never on a
developer's machine directly, so builds are reproducible (the jSquash /
Squoosh approach).

## Toolchains

- **C/C++ codecs** (MozJPEG, libwebp, libavif+libaom, libjxl):
  Emscripten SDK, pinned version per codec, driven by the build scripts in
  `native/`. Output settings: ES6 modules, modularised, no dynamic execution
  (CSP-safe), targets `web,worker`.
- **Rust codecs** (PNG crate, OxiPNG, resize, QOI, the permissive
  quantizer and the `gif`-crate based GIF engine): pinned Rust toolchain
  + plain `cargo build --target wasm32-unknown-unknown` + the
  wasm-bindgen CLI (CLI version pinned to the crate's exact version),
  all inside the Rust Docker image.
- Threaded variants (where upstream supports them, e.g. AVIF) are built as
  separate `*_mt` artifacts and are opt-in at runtime — the default artifacts
  are single-threaded.

## Process

1. Sources are fetched at pinned versions/commits with checksums recorded.
2. `wasm-build.yml` (GitHub Actions) builds inside Docker and uploads
   artifacts; local builds use the same images via the scripts in `native/`.
   **Every codec build ends with a functional smoke gate inside the
   Docker build, and artifacts are re-verified locally in Node before
   they are committed — a green build alone is not proof** (a hollow
   AVIF encoder once passed the build while encoding nothing).
3. Artifacts land in each codec package as versioned, immutable assets.
4. Full third-party licence texts and an attribution file are generated from
   the exact versions built and shipped inside each codec package
   (see THIRD_PARTY_LICENSES.md).
5. Smoke tests run the fresh artifacts in the Playwright browser matrix
   before they can be merged.

## Rules

- Never hand-edit a generated WASM/JS codec artifact.
- Never bump a codec version without a benchmark + browser-matrix run and a
  Changeset.
- Security fixes in upstream codecs take priority over feature work.
