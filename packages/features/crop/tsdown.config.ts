import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/element.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  fixedExtension: false,
});
