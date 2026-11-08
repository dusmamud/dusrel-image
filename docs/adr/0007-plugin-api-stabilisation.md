# ADR-0007: Plugin API stabilisation

- Status: Accepted (2026-11-08)

## Context

Section 6 of the API design promised two plugin kinds — step
(transform) and codec (format) — with "the same error shape as
built-in steps". The Phase 1/2 implementation shipped the step
half (`ImagePlugin`, `codecPlugin`, `imageDataPlugin`) but left
three gaps the Phase 5 audit found:

1. `processImage()` silently discarded `options.plugins` (the
   type comment said "fluent API only") — a registered plugin
   simply never ran, with no error.
2. A codec could only act as a mid-pipeline *step*; it could not
   be selected as the output `format`, so section 6's "add a
   codec (format)" was unimplemented. Relatedly, after a codec
   step the report's `format` still named the canvas
   intermediate, not the blob's real type.
3. Plugin failures propagated as raw errors, not the family's
   typed `DusrelImageError` shape.

## Decision

- Easy mode runs `options.plugins` in order after the core pass
  (before the codec encode), recording `plugin:<name>` steps.
- `options.codecs` registers codec definitions
  (`{ name?, mimeType, encode, options? }`); `options.format`
  accepts any string and resolves non-canvas formats against the
  registrations. Unregistered non-canvas formats throw
  `unsupported-format` before processing. `ImageResult.format`
  and `ProcessReport.format` widen from the canvas union to
  `string` in `@dusrel/image` only; core stays canvas-strict.
- `ImagePlugin.format` declares a step's output MIME type;
  `codecPlugin` stamps the codec's, `imageDataPlugin` stamps
  `image/png`, and pipeline results/reports follow it. The
  pipeline builder gains `.codec(def)` sugar.
- Plugin failures are normalised by `wrapPluginError`:
  typed errors pass through, aborts become `aborted`, everything
  else becomes the new stable code `plugin-failed` (added to
  core's `DusrelErrorCode`) with the original as `cause`.

## Consequences

- One registration shape serves both plugin kinds and both entry
  points; the conformance suite (unit + real-browser) pins the
  contract, including the previously-silent easy-mode drop.
- The format widening is backward compatible for readers (every
  canvas value is still a string) and lets HEIC/placeholder work
  reuse the same registration path later.
