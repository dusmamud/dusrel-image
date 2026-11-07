#!/usr/bin/env bash
# Builds png_enc + png_dec (feature-gated builds of the dusrel-png
# crate) and renames the wasm-bindgen outputs to our asset scheme.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
for kind in enc dec; do
  if [ "$kind" = enc ]; then feature=encode; else feature=decode; fi
  cargo build --release --target wasm32-unknown-unknown -p dusrel-png --features "$feature"
  wasm-bindgen --target web --no-typescript --out-name "png_${kind}" --out-dir out \
    target/wasm32-unknown-unknown/release/dusrel_png.wasm
  mv "out/png_${kind}_bg.wasm" "out/png_${kind}.wasm"
done
cp Cargo.lock out/ 2>/dev/null || true
ls -la out
