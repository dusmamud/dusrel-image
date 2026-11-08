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
    // Vue's esm-bundler build expects bundler-side defines for
    // its feature flags and NODE_ENV (no process global exists
    // in a raw browser module).
    define: {
      "process.env.NODE_ENV": '"production"',
      __VUE_OPTIONS_API__: "true",
      __VUE_PROD_DEVTOOLS__: "false",
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
    },
  },
]);
