#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cp out/qoi_enc.js out/qoi_enc.mjs
cp out/qoi_dec.js out/qoi_dec.mjs
node smoke-qoi.mjs
