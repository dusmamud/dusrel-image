# Playground

A zero-build static page that exercises the whole @dusrel/image
family live in the browser: the `<dusrel-crop>` component,
metadata inspection (EXIF/XMP/ICC), the fluent pipeline with
adjust + watermark plugins, canvas formats **and** the WASM
codecs (MozJPEG, libwebp, AVIF) through `codecPlugin`, plus a
`processBatch` demo with progress.

It loads the workspace packages' built output through an
import map — no bundler, no dev server magic:

```bash
pnpm build            # at the repo root: builds every package's dist/
npx serve .           # serve the REPO ROOT statically (any server works)
# open http://localhost:3000/apps/playground/
```

Everything runs client-side; picked images never leave the tab.
