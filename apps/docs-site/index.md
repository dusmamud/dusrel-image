---
layout: home

hero:
  name: "@dusrel/image"
  text: "Client-side image processing, done properly"
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
