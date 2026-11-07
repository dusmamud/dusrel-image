#!/usr/bin/env bash
# Builds the single dusrel-quantize module.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
cargo build --release --target wasm32-unknown-unknown -p dusrel-quantize
wasm-bindgen --target web --no-typescript --out-name "quantize" --out-dir out \
  target/wasm32-unknown-unknown/release/dusrel_quantize.wasm
mv out/quantize_bg.wasm out/quantize.wasm
cp Cargo.lock out/ 2>/dev/null || true
ls -la out
