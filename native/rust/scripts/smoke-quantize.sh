#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cp out/quantize.js out/quantize.mjs
node smoke-quantize.mjs
