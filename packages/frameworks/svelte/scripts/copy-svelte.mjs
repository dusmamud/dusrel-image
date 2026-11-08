// Ships the component SOURCE (the Svelte ecosystem compiles
// .svelte files in the consumer's build) plus its hand-written
// type declarations, next to the bundled JS entry.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync(new URL("../dist", import.meta.url), { recursive: true });
for (const name of ["DusrelCrop.svelte", "DusrelCrop.svelte.d.ts"]) {
  copyFileSync(
    new URL(`../src/${name}`, import.meta.url),
    new URL(`../dist/${name}`, import.meta.url),
  );
}
console.log("copied DusrelCrop.svelte + types to dist/");
