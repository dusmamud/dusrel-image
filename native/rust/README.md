# native/rust

Reproducible WASM builds of the Rust codec family (`png`, then
`oxipng`, `resize`, `quantize`), mirroring how `native/mozjpeg` etc.
work for the C codecs:

- One Cargo workspace; each codec is its own crate. `png` builds
  twice from one crate via cargo features (`encode` / `decode`) so
  the enc/dec modules stay separately lazy-loadable, exactly like
  the Emscripten codecs.
- Pins: `rust:1.99.1-slim-bookworm`, wasm-bindgen CLI **0.2.130**
  (must match the crate version), crates pinned exactly in each
  `Cargo.toml` (`png = "=0.18.1"`).
- Every build ends with a Node smoke test inside Docker
  (`smoke-<codec>.mjs`) that must pass before artifacts upload —
  a green-but-hollow module fails the build (lesson from AVIF).
- CI: the `wasm-build` workflow's per-codec Rust jobs build this
  image with `--build-arg CODEC=<name>`; verified artifacts are
  committed into `packages/codecs/<name>/codec/`.
