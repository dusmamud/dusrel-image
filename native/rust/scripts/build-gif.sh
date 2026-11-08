#!/usr/bin/env bash
# Builds the single dusrel-gif module and renames the wasm-bindgen
# output to our asset scheme.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
cargo build --release --target wasm32-unknown-unknown -p dusrel-gif
wasm-bindgen --target web --no-typescript --out-name "gif" --out-dir out \
  target/wasm32-unknown-unknown/release/dusrel_gif.wasm
mv "out/gif_bg.wasm" "out/gif.wasm"
cp Cargo.lock out/ 2>/dev/null || true
ls -la out
