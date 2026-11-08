// Compiles src/DusrelCrop.svelte ahead of the tsdown fixture
// build, so the Playwright fixture can mount the REAL component
// (tsdown/rolldown cannot compile .svelte). TypeScript in the
// <script> block is transpiled with the workspace TypeScript.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { compile, preprocess } from "svelte/compiler";
import ts from "typescript";

const source = readFileSync(new URL("../src/DusrelCrop.svelte", import.meta.url), "utf8");
const preprocessed = await preprocess(source, {
  script: ({ content }) => ({
    code: ts.transpileModule(content, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  }),
});
const { js } = compile(preprocessed.code, { filename: "DusrelCrop.svelte" });
mkdirSync(new URL("../test/compiled", import.meta.url), { recursive: true });
writeFileSync(new URL("../test/compiled/DusrelCrop.js", import.meta.url), js.code);
console.log("compiled DusrelCrop.svelte for the browser fixture");
