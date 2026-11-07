# @dusrel/image-metadata

Byte-level metadata for JPEG, PNG and WebP: read EXIF, strip
everything, or strip **only the GPS block** — without decoding a
single pixel, so there is zero quality loss.

```bash
npm install @dusrel/image-metadata
```

```ts
import { readMetadata, stripMetadata, hasGps } from '@dusrel/image-metadata';

const info = readMetadata(bytes);
info.exif?.make;            // 'Canon'
info.exif?.gps;             // { latitude: 28.6, longitude: -77.2 }

const clean = stripMetadata(bytes);                          // everything gone
const noGps = stripMetadata(bytes, { mode: 'gps-only' });    // camera data stays, location goes
```

## API

| Export | What it does |
| --- | --- |
| `detectFormat(bytes)` | `'jpeg' \| 'png' \| 'webp' \| null` from magic bytes |
| `readMetadata(bytes)` | Presence flags (EXIF / XMP / ICC, PNG text keys) + parsed EXIF: make, model, orientation, software, dateTime, dateTimeOriginal, gps |
| `hasGps(bytes)` | Convenience boolean |
| `stripMetadata(bytes, options?)` | New bytes with metadata removed |

## Strip modes

- **`mode: 'all'`** (default) — JPEG: APP1–APP15 + COM segments
  (APP0/JFIF kept). PNG: eXIf, tEXt/iTXt/zTXt, tIME (+ iCCP
  unless `keepIcc`). WebP: EXIF, `XMP ` (+ ICCP unless
  `keepIcc`) **and the VP8X feature bits are cleared and the
  RIFF size rewritten** — decoders must not hunt for chunks that
  no longer exist.
- **`mode: 'gps-only'`** — the TIFF inside the EXIF block is
  re-serialised without the GPS IFD: every other tag survives
  byte-for-byte with offsets recomputed. One documented
  trade-off: a JPEG thumbnail IFD (IFD1) is dropped by the
  rebuild.

## Honest notes

- Image data is copied byte-for-byte; pixels are never touched.
- Unknown formats: `readMetadata` reports `format: null`,
  `stripMetadata` returns an unchanged copy. Malformed files
  degrade to absent fields rather than throwing.
- Remember the context: any Canvas/WASM re-encode already drops
  metadata, because pixels carry none. This package is for the
  original file bytes — inspection and privacy scrubbing without
  a re-encode.
- Status: implemented (Phase 3). Hand-built byte fixtures in Node
  unit tests (GPS rationals → 28.6, −77.2; all three formats,
  both strip modes); Playwright suite splices EXIF into a real
  canvas JPEG in Chromium, Firefox and WebKit.
