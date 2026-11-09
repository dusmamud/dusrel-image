// Assembles the playground into the built docs site.
//
// The playground (apps/playground) is a static page whose import map
// points at the workspace packages' dist/ builds. For deployment we
// copy it into .vitepress/dist/playground and rewrite the import map
// to a local lib/ tree holding each used package's dist/ + codec/
// folders — so https://dusmamud.github.io/dusrel-image/playground/
// works with no build step on the host.
//
// If the package dists are missing (fresh checkout / CI), they are
// built first: TypeDoc and VitePress do not need them, but the
// playground does.
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docsSiteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(docsSiteDir, "../..");
const packagesDir = path.join(repoRoot, "packages");
const playgroundDir = path.join(repoRoot, "apps/playground");
const outDir = path.join(docsSiteDir, ".vitepress/dist/playground");

if (!existsSync(path.join(packagesDir, "image/dist/index.js"))) {
  console.log("[assemble-playground] package dists missing — building workspace packages…");
  execSync("pnpm exec turbo run build --filter='./packages/**'", {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

mkdirSync(outDir, { recursive: true });
for (const f of ["styles.css", "main.js", "logo.svg"]) {
  cpSync(path.join(playgroundDir, f), path.join(outDir, f));
}

// Rewrite the import map and copy each referenced package once.
const html = readFileSync(path.join(playgroundDir, "index.html"), "utf8");
const mapMatch = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!mapMatch) throw new Error("playground index.html has no import map");
const importMap = JSON.parse(mapMatch[1]);
const copied = new Set();
for (const [specifier, target] of Object.entries(importMap.imports)) {
  const absTarget = path.resolve(playgroundDir, target);
  if (!existsSync(absTarget)) {
    throw new Error(`import map target for ${specifier} does not exist: ${target}`);
  }
  // Package root = the directory holding package.json above the target.
  let pkgRoot = path.dirname(absTarget);
  while (!existsSync(path.join(pkgRoot, "package.json"))) {
    const up = path.dirname(pkgRoot);
    if (up === pkgRoot) throw new Error(`no package.json found above ${absTarget}`);
    pkgRoot = up;
  }
  if (!pkgRoot.startsWith(packagesDir)) {
    throw new Error(`package root for ${specifier} escaped packages/: ${pkgRoot}`);
  }
  const relPkg = path.relative(packagesDir, pkgRoot); // e.g. codecs/avif
  if (!copied.has(relPkg)) {
    const destRoot = path.join(outDir, "lib", relPkg);
    for (const sub of ["dist", "codec"]) {
      const src = path.join(pkgRoot, sub);
      if (existsSync(src)) cpSync(src, path.join(destRoot, sub), { recursive: true });
    }
    copied.add(relPkg);
  }
  const relTarget = path.relative(packagesDir, absTarget); // e.g. codecs/avif/dist/index.js
  importMap.imports[specifier] = `./lib/${relTarget.split(path.sep).join("/")}`;
}
const rewritten = html.replace(
  mapMatch[0],
  `<script type="importmap">\n${JSON.stringify(importMap, null, 2)}\n    </script>`,
);
writeFileSync(path.join(outDir, "index.html"), rewritten);

// The HEIC sample the playground's "Load sample.heic" button fetches.
cpSync(path.join(packagesDir, "codecs/heic/test/fixture.heic"), path.join(outDir, "sample.heic"));

console.log(
  `[assemble-playground] playground assembled at ${path.relative(repoRoot, outDir)} ` +
    `(${copied.size} packages: ${[...copied].join(", ")})`,
);
