# ADR-0008: HEIC decode — investigation and licence position

- Status: Accepted (2026-11-08) — Dus chose Option A
  ("Option A add karo"). Implementation follows the codec
  recipe in the Consequences below: own Emscripten build of
  libheif v1.23.7 + libde265 1.0.15 under `native/heic/`,
  decode-only, native-first.

## Context

iPhone photos arrive as HEIC/HEIF, and no browser except
Safari 17+ (macOS Sonoma / iOS 17 and later, per caniuse) can
decode them natively. Chrome, Edge and Firefox cannot decode
HEIC in their image pipelines at all (some Chromium builds can
reach an OS codec through WebCodecs `VideoDecoder` on macOS,
but `<img>` / `createImageBitmap` fail). A client-side library
that cannot open the most common phone photo format has a real
gap, so Phase 5 investigated a decode-only
`@dusrel/image-heic` package.

## Findings (Exa cross-verified, 2026-11-08)

- The only production-grade open decoder is **libheif**
  (struktur AG) with **libde265** for HEVC. Both are
  **LGPL-3.0**. The maintained Emscripten distribution
  **libheif-js** (v1.23.x, ~4.8M weekly npm downloads) is also
  LGPL-3.0. There is no permissively licensed HEVC decoder;
  `heic2any` is MIT-labelled but bundles libheif underneath
  and is known to shift colours on many phone photos.
- **Decode-only avoids the GPL trap**: HEIC *encoding* would
  need x265 (GPL-2.0) — out of scope. Decoding needs only
  libde265 (LGPL-3.0). kvazaar (BSD) exists for encoding but
  is not needed.
- **Native-first is real**: `createImageBitmap` decodes HEIC
  on WebKit/Safari (measured 12 MP in ~71 ms, orientation
  honoured, grid tiles stitched) and rejects in 0–1 ms on
  Chromium/Firefox. The probe *is* the decode, so nothing is
  decoded twice and no WASM is fetched where native works.
- **LGPL compliance in the browser is a solved pattern.**
  Multiple production sites ship libheif-js exactly the way
  this repo already ships codecs: the `.js` + `.wasm` as
  separate, unmodified files, lazy-loaded only when a HEIC
  file appears, licence texts and the corresponding source
  published alongside, and the files replaceable by the user.
  Our per-package `setCodecAssets({ jsUrl, wasmUrl })`
  override is precisely the LGPL "replace the library"
  mechanism. The package's own wrapper code stays MIT; only
  the engine files carry LGPL-3.0.
- **Patent caveat (must stay visible)**: HEVC is covered by
  patent pools. LGPL clears copyright, not patents. libheif's
  own distributors note this explicitly; the package README
  must too.
- Format handling notes: detect HEIC by the `ftyp` box
  brands (`heic`, `heix`, `heis`, `mif1`, `msf1`, …), never
  by file extension or MIME type (Windows often reports an
  empty type). HEIC files can hold multiple images — decode
  the primary one. Orientation comes from the container
  (`irot`) / EXIF. Safari refuses canvases above ~16.7 MP,
  so a size guard belongs in the wrapper.

## Options

- **A. Ship `@dusrel/image-heic`, decode-only, engine LGPL.**
  Own Emscripten build of libheif + libde265 under
  `native/heic/` (the repo's codec recipe, in-Docker smoke
  gate), wrapper MIT, engine files LGPL-3.0 with licence
  texts + source links in the package, native-first probing,
  WASM loaded only for non-Safari browsers. Breaks the
  "every engine is permissive" streak for exactly one
  opt-in, separately installed package; the core and every
  other package stay untouched.
- **B. Ship the wrapper only, decoder supplied by the user.**
  `@dusrel/image-heic` ships no HEVC code at all; the caller
  passes a libheif build via `setCodecAssets`. Zero licence
  exposure for the repo, worse developer experience, and
  most users will not have a build to point at.
- **C. No HEIC package.** Document the gap; users on
  Chrome/Firefox simply cannot open iPhone photos. The gap
  is the single most common real-world format complaint for
  browser image tools.

## Recommendation

Option A, **if** Dus accepts one LGPL engine in one opt-in
package (the earlier licence decisions replaced GPL engines
because a permissive alternative existed; here none does).
Decode-only, native-first, separate files, honest README
covering LGPL terms and the HEVC patent note. If the answer
is no, Option B keeps a usable path with zero exposure.

## Consequences

- Implementation (when approved) follows the Phase 2 codec
  recipe exactly: pinned Emscripten build, functional smoke
  gate inside Docker, artifacts re-verified in Node before
  committing, browser spec on all three engines (with the
  native path exercised on WebKit).
- THIRD_PARTY_LICENSES.md gains its first LGPL row, clearly
  fenced to this package.
