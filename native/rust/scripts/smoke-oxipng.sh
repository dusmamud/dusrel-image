#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cp out/oxipng.js out/oxipng.mjs
node smoke-oxipng.mjs
