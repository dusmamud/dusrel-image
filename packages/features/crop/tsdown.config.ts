import { defineConfig } from "tsdown";

// Two SEPARATE single-entry builds (not one two-entry build):
// a shared build code-splits the geometry module into a chunk
// file, and dist/element.js would then import './geometry-*.js'
// relatively — which breaks Blob-URL/dynamic loading and any
// host that serves the element entry on its own. Each entry
// must be self-contained.
const base = {
  format: ["esm"] as const,
  dts: true,
  sourcemap: true,
  fixedExtension: false,
};

export default defineConfig([
  { ...base, entry: ["src/index.ts"], clean: true },
  { ...base, entry: ["src/element.ts"], clean: false },
]);
