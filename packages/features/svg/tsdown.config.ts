import { defineConfig } from "tsdown";

const base = {
  format: ["esm"] as const,
  sourcemap: true,
  fixedExtension: false,
};

// Two separate builds: the publishable library entry (svgo stays
// an external dependency) and the self-contained browser-test
// fixture (svgo bundled, so the Playwright spec can load it
// from a Blob URL).
export default defineConfig([
  { ...base, entry: ["src/index.ts"], dts: true, clean: true },
  {
    ...base,
    entry: ["test/browser-fixture.ts"],
    dts: false,
    outDir: "test/.fixture",
    clean: true,
    noExternal: [/.*/],
    outputOptions: { inlineDynamicImports: true },
  },
]);
