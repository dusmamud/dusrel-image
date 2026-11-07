#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cp out/resize.js out/resize.mjs
node smoke-resize.mjs
