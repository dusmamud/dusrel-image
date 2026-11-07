#!/usr/bin/env bash
# Builds the single dusrel-oxipng module (an optimiser has one
# operation, so unlike png there is no enc/dec split).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
cargo build --release --target wasm32-unknown-unknown -p dusrel-oxipng
wasm-bindgen --target web --no-typescript --out-name "oxipng" --out-dir out \
  target/wasm32-unknown-unknown/release/dusrel_oxipng.wasm
mv out/oxipng_bg.wasm out/oxipng.wasm
cp Cargo.lock out/ 2>/dev/null || true
ls -la out
