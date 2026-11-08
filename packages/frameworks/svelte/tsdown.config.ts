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
    entry: ["test/browser-fixture.ts"],
    dts: false,
    clean: true,
    outDir: "test/.fixture",
    noExternal: [/.*/],
    outputOptions: { inlineDynamicImports: true },
  },
]);
