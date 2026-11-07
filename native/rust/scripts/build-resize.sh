#!/usr/bin/env bash
# Builds the single dusrel-resize module.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
cargo build --release --target wasm32-unknown-unknown -p dusrel-resize
wasm-bindgen --target web --no-typescript --out-name "resize" --out-dir out \
  target/wasm32-unknown-unknown/release/dusrel_resize.wasm
mv out/resize_bg.wasm out/resize.wasm
cp Cargo.lock out/ 2>/dev/null || true
ls -la out
