# Bundlers & codec assets

Codec packages ship two files per direction — a glue `.js` and a
`.wasm` — and load them from URLs resolved relative to their own
module (`new URL('../codec/…', import.meta.url)`). Whether that
works out of the box depends on your bundler's handling of those
URLs. This page is the field guide, distilled from the project's
own [consumer test](https://github.com/dusmamud/dusrel-consumer-test),
which installs the published packages in a plain Vite app and
exercises every codec.

Two mechanisms always work, in every setup:

1. **Let the default URLs resolve** — keep the package's files
   where the loader expects them (per-bundler notes below).
2. **`setCodecAssets(...)`** — every codec package exports it.
   Import the four (or two) codec files as asset URLs in whatever
   way your bundler likes and hand the URLs over. Call it any
   time; the codec reloads from the new URLs on next use. This is
   also the mechanism for **self-hosting the codec files or
   pinning them to a CDN**.

## Vite

**Production builds work by default**: Vite emits the codec
files as assets and rewrites the URLs.

**Vite dev is the trap.** The dev server pre-bundles dependencies
into `node_modules/.vite/deps/`, relocating the codec code; the
relative WASM request then returns the page HTML instead of the
binary, and the codec fails to start.

Fix A — exclude the codec packages from pre-bundling:

```ts
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: [
      '@dusrel/image-jpeg', '@dusrel/image-webp', '@dusrel/image-avif',
      '@dusrel/image-png', '@dusrel/image-oxipng', '@dusrel/image-quantize',
      '@dusrel/image-resize', '@dusrel/image-jxl', '@dusrel/image-qoi',
      '@dusrel/image-heic', '@dusrel/image-gif',
    ],
  },
});
```

(Delete `node_modules/.vite` once after changing this, so the
old pre-bundle is not reused.)

Fix B — `setCodecAssets` with `?url` imports (dev and production,
no config change):

```ts
import { setCodecAssets } from '@dusrel/image-jpeg';
import encJs from '@dusrel/image-jpeg/codec/mozjpeg_enc.js?url';
import encWasm from '@dusrel/image-jpeg/codec/mozjpeg_enc.wasm?url';
import decJs from '@dusrel/image-jpeg/codec/mozjpeg_dec.js?url';
import decWasm from '@dusrel/image-jpeg/codec/mozjpeg_dec.wasm?url';

setCodecAssets({
  encodeJsUrl: encJs,
  encodeWasmUrl: encWasm,
  decodeJsUrl: decJs,
  decodeWasmUrl: decWasm,
});
```

Both fixes are verified against the published packages; the
consumer test app demonstrates Fix B live.

## webpack 5 / Next.js

webpack 5 understands `new URL('./asset', import.meta.url)` as an
asset reference and emits the file — for most setups the default
URLs keep working. Where a custom configuration interferes (or
under Next.js server components, which must never import codec
packages — they are browser-only), fall back to the universal
mechanism: import the codec files through your asset pipeline
(`asset/resource` or the framework's static import) and pass the
resulting URLs to `setCodecAssets`, from a client component.

## No bundler — CDN + import maps

The packages are plain ESM. Serve (or CDN-host) each package's
`dist/` and `codec/` folders side by side, map the bare
specifiers in an import map, and the default relative URLs
resolve with no configuration at all. `examples/cdn` in the
repository is a complete page doing exactly this, and the
[playground](https://dusmamud.github.io/dusrel-image/playground/)
on this site is assembled the same way.

## Hosting notes

- Serve `.wasm` files as `application/wasm` (any static host,
  GitHub Pages and Cloudflare Pages included, does this by
  extension).
- The default builds are **single-threaded** — no
  `SharedArrayBuffer`, so **no COOP/COEP headers are required**
  and the codecs embed cleanly in third-party pages. Threaded
  builds remain an explicit opt-in (see ADR-0006).
- Codec files are sizeable (AVIF encoder ≈ 3.6 MB, JPEG XL
  encoder ≈ 2.4 MB, HEIC decoder ≈ 1.2 MB). They load lazily on
  first use of that codec — keep them on the same CDN as your
  app and let HTTP caching do its work. Full measured sizes are
  in the [codec guide](/guide/codec-guide).
