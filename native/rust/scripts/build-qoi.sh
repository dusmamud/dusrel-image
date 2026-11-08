#!/usr/bin/env bash
# Builds qoi_enc + qoi_dec (feature-gated builds of the dusrel-qoi
# crate) and renames the wasm-bindgen outputs to our asset scheme.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
for kind in enc dec; do
  if [ "$kind" = enc ]; then feature=encode; else feature=decode; fi
  cargo build --release --target wasm32-unknown-unknown -p dusrel-qoi --features "$feature"
  wasm-bindgen --target web --no-typescript --out-name "qoi_${kind}" --out-dir out \
    target/wasm32-unknown-unknown/release/dusrel_qoi.wasm
  mv "out/qoi_${kind}_bg.wasm" "out/qoi_${kind}.wasm"
done
cp Cargo.lock out/ 2>/dev/null || true
ls -la out
