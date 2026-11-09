---
layout: home

hero:
  name: "@dusrel/image"
  text: "Client-side image processing, done properly"
  image:
    src: /logo.svg
    alt: Dusrel logo
  tagline: Compress, crop, resize, rotate and convert images entirely in the browser. No backend, no uploads, no server cost — with WASM codecs and maximum developer control.
  actions:
    - theme: brand
      text: Quickstart
      link: /guide/quickstart
    - theme: alt
      text: Live playground
      link: https://dusmamud.github.io/dusrel-image/playground/
    - theme: alt
      text: API reference
      link: /api/index.html

features:
  - title: Zero-backend by design
    details: Every operation runs on the visitor's device. Images never leave the tab, so there is nothing to host, scale or pay for.
  - title: One-call easy mode, pro pipeline when you need it
    details: processImage(file, { format, quality, targetSize }) for the common case; a fluent pipeline with plugins, fallback policies and a full process report for everything else.
  - title: Real codecs, separately installable
    details: MozJPEG, libwebp, libavif, the Rust png/oxipng/resize/quantize modules — each its own @dusrel/ sub-package with lazily loaded WASM, never bundled into the core.
  - title: Features as packages, not bloat
    details: An accessible crop Web Component, EXIF metadata read/strip, transforms, adjustments, watermarking and a worker-pool batch engine — install only what you use.
  - title: Framework bindings included
    details: First-class React, Vue and Svelte packages with state hooks/composables/stores and typed crop components.
  - title: Honest engineering
    details: Typed errors with stable codes, target-size mode that reports when the budget can't be met, and every package proven in real Chromium, Firefox and WebKit on CI.
---

## In one line

```ts
import { processImage } from '@dusrel/image';

const { blob, report } = await processImage(file, {
  format: 'image/webp',
  maxSizeBytes: 200_000, // byte budget — the engine searches quality for you
});
```

<div class="stats-strip">
  <div class="stat"><strong>24</strong><span>packages, one lockstep version</span></div>
  <div class="stat"><strong>10</strong><span>WASM codecs, lazily loaded</span></div>
  <div class="stat"><strong>3</strong><span>browser engines proven on CI</span></div>
  <div class="stat"><strong>0</strong><span>servers, uploads or tracking</span></div>
</div>

## Why client-side?

<div class="why-grid">
  <div class="why-card">
    <h3>Private by architecture</h3>
    <p>There is no upload endpoint, so there is nothing to leak, breach or
    subpoena. Your users' photos never leave their device — compliance
    reviews get very short.</p>
  </div>
  <div class="why-card">
    <h3>Zero running cost</h3>
    <p>The visitor's CPU does the work. No image servers to host, scale,
    patch or pay for — a static site and this library are the whole
    infrastructure.</p>
  </div>
  <div class="why-card">
    <h3>Embeds anywhere</h3>
    <p>Single-threaded WASM by default: no <code>SharedArrayBuffer</code>, no
    COOP/COEP headers, no cross-origin isolation. Drop it into any page,
    widget or webview.</p>
  </div>
</div>

## Three ways to use it

::: code-group

```ts [Easy mode]
import { processImage } from '@dusrel/image';

const { blob, report } = await processImage(file, {
  format: 'image/webp',
  quality: 0.8,
  resize: { width: 1600 },
  crop: { x: 80, y: 60, width: 640, height: 480 },
});

console.log(report.stepsApplied, report.savingsRatio);
```

```ts [Pipeline + plugins]
import { pipeline, codecPlugin, imageDataPlugin } from '@dusrel/image';
import { encode } from '@dusrel/image-avif';
import { adjust } from '@dusrel/image-adjust';

const { blob } = await pipeline(file)
  .resize({ width: 1200 })
  .use(imageDataPlugin({ name: 'adjust', transform: (d) => adjust(d, { saturation: 0.1 }) }))
  .use(codecPlugin({ mimeType: 'image/avif', encode: (d) => encode(d, { quality: 55 }) }))
  .run();
```

```tsx [React]
import { useProcessImage } from '@dusrel/image-react';

function Compressor() {
  const { process, processing, progress, result } = useProcessImage();
  return (
    <>
      <input type="file" accept="image/*" onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void process(f, { format: 'image/webp', quality: 0.8 });
      }} />
      {processing && <progress value={progress} max={1} />}
      {result && <img src={URL.createObjectURL(result.blob)} alt="" />}
    </>
  );
}
```

:::

## The family at a glance

| Group | Packages | What's inside |
| --- | --- | --- |
| Core | 2 | `@dusrel/image` (flagship) + the zero-dependency canvas engine |
| Codecs | 10 | MozJPEG, libwebp, libavif, Rust PNG/QOI, OxiPNG, quantize, resize, libjxl, libheif (HEIC decode) |
| Features | 9 | Crop component, transform, adjust, metadata, watermark, batch, GIF, SVG, placeholders |
| Frameworks | 3 | React, Vue and Svelte bindings with typed crop components |

[See all 24 packages →](/packages) · [Cookbook: tasks mapped to packages →](/guide/cookbook)

## Browser support

Every package's browser spec runs on CI in Chromium, Firefox and
WebKit (Playwright) — the 1.0.x releases are green on all three.

| | Chrome / Edge | Firefox | Safari |
| --- | --- | --- | --- |
| Core + canvas formats | <span class="bs-ic bs-yes" role="img" aria-label="Supported"></span> | <span class="bs-ic bs-yes" role="img" aria-label="Supported"></span> | <span class="bs-ic bs-yes" role="img" aria-label="Supported"></span> (16.4+ for the worker path) |
| WASM codecs | <span class="bs-ic bs-yes" role="img" aria-label="Supported"></span> | <span class="bs-ic bs-yes" role="img" aria-label="Supported"></span> | <span class="bs-ic bs-yes" role="img" aria-label="Supported"></span> |
| HEIC decode | <span class="bs-ic bs-fallback" role="img" aria-label="Via WASM fallback"></span> WASM fallback | <span class="bs-ic bs-fallback" role="img" aria-label="Via WASM fallback"></span> WASM fallback | <span class="bs-ic bs-yes" role="img" aria-label="Supported"></span> Native (17+), WASM elsewhere |

[Full support matrix and known quirks →](/guide/browser-support)

## FAQ

::: details Is it really free? What does it cost to run?
Yes — MIT licensed (the HEIC decoder's engine is LGPL-3.0, fenced
inside its own package; see ADR-0008). Running cost is zero: all
processing happens on your visitors' devices.
:::

::: details Which formats can it produce?
Built in: JPEG, PNG, WebP. Register a codec package to add AVIF,
JPEG XL, QOI and GIF — plus MozJPEG/libwebp/Rust-PNG encoders that
outperform the canvas ones. HEIC is decode-only (there is no
permissively licensed HEVC encoder).
:::

::: details My Vite dev server serves HTML instead of the WASM file. Why?
Vite's dev pre-bundling relocates the codec code and breaks its
relative asset URLs. Exclude the codec packages from
`optimizeDeps`, or pass explicit URLs with `setCodecAssets` —
both fixes are written up in
[Bundlers & codec assets](/guide/bundlers).
:::

::: details Do I need COOP/COEP headers or a special server?
No. The default builds are single-threaded and need no
`SharedArrayBuffer`. Just serve `.wasm` as `application/wasm`,
which every static host does by extension.
:::

::: details Can it hit an exact file-size target?
Give `maxSizeBytes` and the engine searches quality for you.
`result.targetSizeMet` reports honestly whether the budget was
met — the smallest best-effort result is returned either way.
:::

<div class="cta-band">
  <div>
    <h2>Try every codec in your browser</h2>
    <p>The playground runs the whole family live — no install, no uploads.</p>
  </div>
  <div class="cta-actions">
    <a class="cta-primary" href="https://dusmamud.github.io/dusrel-image/playground/">Open the playground</a>
    <a class="cta-secondary" href="/dusrel-image/guide/quickstart">Read the quickstart</a>
  </div>
</div>
