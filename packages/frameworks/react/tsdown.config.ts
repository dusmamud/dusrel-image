import { defineConfig } from "tsdown";

const base = {
  format: ["esm"] as const,
  sourcemap: true,
  fixedExtension: false,
};

// Two separate builds: the publishable library entry (deps stay
// external) and the self-contained browser-test fixture (deps
// bundled, so the Playwright spec can load it from a Blob URL).
export default defineConfig([
  { ...base, entry: ["src/index.ts"], dts: true, clean: true },
  {
    ...base,
    entry: ["test/browser-fixture.tsx"],
    dts: false,
    outDir: "test/.fixture",
    clean: true,
    noExternal: [/.*/],
    // The library entry lazy-imports the crop element (SSR
    // safety); the fixture must be ONE file for Blob-URL loading,
    // so dynamic imports are inlined here.
    outputOptions: { inlineDynamicImports: true },
    // React's CJS entry branches on process.env.NODE_ENV, which
    // does not exist in a raw browser module — pin production
    // (consumers' bundlers do the same for the library build).
    define: { "process.env.NODE_ENV": '"production"' },
  },
]);
