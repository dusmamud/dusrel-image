#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cp out/png_enc.js out/png_enc.mjs
cp out/png_dec.js out/png_dec.mjs
node smoke-png.mjs
