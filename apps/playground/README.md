# Playground

A zero-build static page that exercises the whole @dusrel/image
family live in the browser: the `<dusrel-crop>` component, metadata
inspection (EXIF/XMP/ICC), the fluent pipeline with crop / resize /
rotate / flip + adjust and watermark plugins, canvas formats **and**
every WASM codec (AVIF, MozJPEG, libwebp, Rust PNG, JPEG XL, QOI,
GIF) through `codecPlugin`, an OxiPNG post-optimise step, HEIC
inputs decoded in-browser via `@dusrel/image-heic`, a
`processBatch` demo with progress, and ThumbHash / BlurHash
placeholder generation. Built-in sample buttons load a generated
test image or the bundled `sample.heic`, so every tool can be tried
without a file on disk.

**Live:** the playground is deployed with the documentation site at
https://dusmamud.github.io/dusrel-image/playground/ — the docs
site's build assembles it (see
`apps/docs-site/scripts/assemble-playground.mjs`).

It loads the workspace packages' built output through an
import map — no bundler, no dev server magic:

```bash
pnpm build            # at the repo root: builds every package's dist/
npx serve .           # serve the REPO ROOT statically (any server works)
# open http://localhost:3000/apps/playground/
```

Everything runs client-side; picked images never leave the tab.
