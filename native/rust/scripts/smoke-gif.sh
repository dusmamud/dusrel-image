#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cp out/gif.js out/gif.mjs
node smoke-gif.mjs
