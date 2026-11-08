# @dusrel/image-heic

HEIC/HEIF **decode** for the browser — the iPhone photo format
that only Safari can open natively. Part of the
[@dusrel/image](../..) family; see ADR-0008 for the decision
record behind this package.

```ts
import { decodeHeic } from "@dusrel/image-heic";

const pixels: ImageData = await decodeHeic(fileBytes);
// or straight from a File/Blob:
const fromFile = await decodeHeic(await file.arrayBuffer());
```

## How it works

- **Native-first (default).** On Safari 17+ the file is handed
  to `createImageBitmap`, which decodes HEIC natively —
  orientation honoured, grid tiles stitched — and the bundled
  WASM is never downloaded. The attempt *is* the probe: where
  native works, nothing is decoded twice.
- **WASM fallback.** Everywhere else, a decode-only build of
  **libheif + libde265** (WebAssembly, lazy-loaded on first
  use) decodes the primary image. The engine applies the
  container's rotation/cropping/mirroring, so pixels come out
  upright as RGBA. Force it with
  `decodeHeic(bytes, { nativeFirst: false })` or call
  `decodeHeicWasm(bytes)` directly for identical output in
  every browser.
- Detection is by the file's `ftyp` brands (`isHeic`), never
  by extension or MIME type — Windows reports an empty type
  for genuine HEIC files.

## Licence — read this one

This package is the family's **single exception** to its
all-permissive rule (ADR-0008), because no permissively
licensed HEVC decoder exists:

- The **wrapper code** in this package is **MIT**, like every
  other @dusrel package.
- The **engine files** in `codec/` (`heic_dec.js`,
  `heic_dec.wasm`) are a build of **libheif v1.23.7** and
  **libde265 1.0.15**, both **LGPL-3.0**. They are shipped
  unmodified as separate, lazy-loaded files; the full licence
  texts ship in the package (`codec/LICENSE.libheif`,
  `codec/LICENSE.libde265`), the corresponding source is at
  https://github.com/strukturag/libheif (v1.23.7) and
  https://github.com/strukturag/libde265 (v1.0.15), the build
  recipe is this repo's `native/heic/`, and
  `setCodecAssets({ jsUrl, wasmUrl })` lets you replace the
  engine files with your own build at runtime — the LGPL
  relink/replace mechanism, by design.
- **Patent note:** HEVC is covered by patent pools. The LGPL
  clears the copyright side only; whether you need a patent
  licence for your use is your jurisdiction's question, the
  same caveat libheif's own distributors state.

## API

- `decodeHeic(input, options?)` — `Uint8Array | ArrayBuffer |
  Blob` → `Promise<ImageData>`. Options: `nativeFirst`
  (default `true`). Throws `RangeError` for non-HEIC input.
- `decodeHeicWasm(bytes)` — always the WASM path.
- `isHeic(bytes)` — `ftyp` brand sniff.
- `init(assets?)` / `setCodecAssets({ jsUrl, wasmUrl })` —
  preload or relocate the engine files.

## Notes and limits

- Decode-only. HEIC *encoding* would require a GPL encoder
  (x265) and is out of scope by design.
- Multi-image files decode their **primary** image.
- Very large photos are bounded by the browser's canvas
  limits on the native path (Safari refuses ~16.7 MP+
  canvases); the WASM path then takes over automatically.
- Engine size: `heic_dec.wasm` is 1,202,357 bytes.
