# @dusrel/image-gif

GIF encode / decode / optimise — animated GIFs included — via the
Rust `gif` crate compiled to WASM (lazy-loaded, single module).
Engine decided 2026-11-07: gifsicle was dropped on licence grounds
(GPL-2.0-only) so this package stays MIT — see
THIRD_PARTY_LICENSES.md.

```ts
import { encode, decode, optimize } from "@dusrel/image-gif";

const bytes = await encode(
  [
    { data: frameA, delay: 100 },
    { data: frameB, delay: 200 },
  ],
  { repeat: 0, speed: 10, palette: "per-frame" },
);

const gif = await decode(bytes); // { width, height, repeat, frames }
const smaller = await optimize(bytes, { palette: "global" });
```

Options (maximum control, easy defaults):

- `repeat`: 0 = loop forever (default), -1 = no loop block (plays
  once), n = loop n more times (gif.js semantics).
- `speed` 1..30 (default 10): NeuQuant sampling — 1 is the best
  quality and slowest, 30 the fastest.
- `palette`: `"per-frame"` (default) gives each frame its own
  palette; `"global"` builds ONE palette sampled from all frames
  and shares it — the classic multi-frame size win.
- Per-frame `delay` in milliseconds (rounded to the format's
  native 10 ms unit).

Format realities, honestly stated: GIF colour is palette-based
(at most 256 colours per palette) and alpha is binary — fully
transparent pixels become the transparent slot, everything else
is opaque. Decoding composites sub-rectangle frames onto a full
canvas with keep-disposal semantics (what virtually all encoders,
including this one, emit); exotic disposal chains may differ.

Artifact: `gif.wasm` 128,447 B (+ ~7 KB JS glue), built by the
`wasm-build` workflow from `native/rust` (CODEC=gif),
functionally smoke-gated in Docker and re-verified locally
before commit. Engine licences: `gif` crate MIT OR Apache-2.0,
`color_quant` MIT.
