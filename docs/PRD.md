# PRD — Product Requirements Document: dusrel-image

- Version: 1.0 (locked, 2026-11-07)
- Owner: Dus (dusrel)
- Status: Approved baseline. Changes require a new ADR or a PRD revision.

## 1. Problem

Web apps constantly receive oversized images: phone photos of 5-15 MB uploaded
for avatars, product listings, documents and posts. Sending them to a server
for resizing wastes bandwidth, money and user privacy, and is slow on mobile
networks. Existing browser libraries are either one-trick compressors built on
Canvas (weak quality, no AVIF, no real PNG compression), heavy editors, or
server SDKs. Developers need one family that does **everything** in the
browser, is tiny by default, and gives full control when needed.

## 2. Product

`dusrel-image`: a family of npm packages under the `@dusrel/` scope that
processes images **100% client-side** — no backend, no uploads, no tracking.

- Main package: `@dusrel/image`
- Modelled on the jSquash / Squoosh sub-package architecture, built from
  scratch by dusrel (own core, pipeline, API, tests, docs). Proven native
  codec engines are compiled to WASM and reused under their licences;
  codec engines are not rewritten from scratch (see ADR-0003).

## 3. Users / personas

1. **Beginner developer** — wants one call: give a file, get a smaller file.
   Needs sensible defaults and an easy mode.
2. **Professional developer** — wants every knob: codec choice, quality curves,
   target-size strategy, fallback behaviour, worker count, custom plugins.
3. **End user of the developer's app** — never sees dusrel-image directly;
   benefits from faster uploads and privacy (photos never leave the device).

## 4. Goals

- G1: Cover the full browser image workflow in one family (section 5).
- G2: Core stays tiny: `@dusrel/image-core` <= 10 KB gzip, zero dependencies.
- G3: Quality that matches server tools on common cases (benchmark targets in
  PERFORMANCE.md).
- G4: Works in every modern browser and every framework (vanilla, React, Vue,
  Svelte, Angular, CDN script usage).
- G5: Zero operating cost for us and for developers: no backend to run.

## 5. Feature requirements (maximum features — this list is the contract)

### 5.1 Compression
Quality control; exact target-size mode (e.g. "under 500 KB") with automatic
retries; iteration cap; keep-resolution vs shrink-to-fit strategies; per-format
strategies; before/after report (sizes, dimensions, savings %, time).

### 5.2 Resize / reduce
Width, height, percentage, max-dimension; aspect-ratio lock; fit modes
(contain / cover / fill); upscale allowed or blocked; high-quality algorithms
(Lanczos etc. via image-resize); thumbnail presets.

### 5.3 Crop
Free and fixed aspect ratios (1:1, 16:9, custom); rectangle and circle;
zoom, pan, drag; keyboard accessible UI (separate UI package, core returns
coordinates only).

### 5.4 Rotate / flip / transform
90-degree steps and arbitrary angles; horizontal/vertical flip; background
fill colour for exposed corners; EXIF auto-orientation.

### 5.5 Convert
JPEG, PNG, WebP, AVIF (plus experimental JXL, optional QOI, GIF, SVG
optimisation). Alpha handling rules per target format (e.g. flatten colour
when going to JPEG).

### 5.6 Adjust & effects
Brightness, contrast, saturation, sharpness, blur, grayscale/sepia class
filters, watermark (image or text, position/opacity/scale controlled).

### 5.7 Metadata
Read EXIF; strip all metadata by default; preserve-on-request; GPS-only
removal; ICC handling documented per codec.

### 5.8 Batch & performance controls
Multiple files; queue with per-file and total progress; pause/cancel
(AbortSignal); configurable worker pool size; memory safeguards and cleanup;
configurable timeouts.

### 5.9 Developer control (the differentiator)
Order of operations is developer-defined; native Canvas vs WASM engine
selectable per format; fallback behaviour selectable (return original, throw,
or downgrade format); event hooks before/after each step; plugin API to
register custom codecs/steps; stable typed error codes; debug logging opt-in.

### 5.10 Output control
Blob, File, ArrayBuffer, base64, object URL or ImageData; filename patterns
and suffixes; full processing report.

## 6. Non-goals (v1)

- No backend/server component of any kind.
- No AI cloud features (background removal etc. may come later as an optional
  client-side plugin, never as a server dependency).
- No video processing. No RAW camera formats. HEIC decoding is a later
  optional plugin, not v1 core.
- No image hosting, storage or upload service — output is handed back to the
  developer's app.

## 7. Success metrics

- Core size budget met in CI (<= 10 KB gzip).
- Benchmark corpus: JPEG (MozJPEG) median >= 50% saving at q75, AVIF >= 55%,
  lossy PNG >= 70% — see PERFORMANCE.md for method.
- Works (with documented fallbacks) on the browser matrix in
  BROWSER_SUPPORT.md.
- npm weekly downloads and GitHub stars tracked after launch (targets set at
  launch review, not in this PRD).

## 8. Constraints & assumptions

- npm scope `@dusrel` is owned by Dus via the npm org `dusrel`
  (created by Dus and verified against the npm registry on 2026-11-07).
- All `@dusrel/image-*` packages version in lockstep.
- Licences of reused codecs must be honoured; the licence items in
  THIRD_PARTY_LICENSES.md were closed on 2026-11-07 (GPL engines dropped,
  permissive replacements chosen).

## 9. Roadmap summary

Phases are detailed in ROADMAP.md: docs -> skeleton + CI -> core + main
pipeline -> WASM codecs (jpeg, webp, avif, png, oxipng, quantize, resize) ->
crop/transform/metadata/batch -> framework wrappers -> experimental
(jxl, qoi, gif, svg, heic plugin).
