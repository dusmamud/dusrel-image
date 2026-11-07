# @dusrel/image-avif

libavif + libaom codec (WASM, lazy-loaded — only fetched when AVIF is chosen).

```ts
import { decode, encode } from "@dusrel/image-avif";

const bytes = await encode(imageData, { quality: 50 }); // ArrayBuffer (AVIF)
const pixels = await decode(bytes); // ImageData
```

## Options (maximum control)

| Option         | Range       | Default | Notes                                                            |
| -------------- | ----------- | ------- | ---------------------------------------------------------------- |
| `quality`      | 0..100      | 50      |                                                                  |
| `qualityAlpha` | 0..100      | quality | Alpha channel quality, independent of colour.                    |
| `speed`        | 0..10       | **9**   | 10 = fastest. Lower speeds are much slower (docs/CODEC_GUIDE.md). |
| `pixelFormat`  | 420/444/422 | '420'   | '444' keeps full chroma; quality 100 + '444' is near-lossless.   |

Separate `encode`/`decode` modules, each lazy-loaded on first use;
`setCodecAssets()` points them at CDN-hosted artifacts. Single-threaded
by design — the threaded encoder stays opt-in (cross-origin isolation).

## Artifacts (built by CI from `native/avif`, smoke-gated in the build)

- libaom **v3.12.1** (generic CPU target) + libavif **v1.4.2**, emsdk 3.1.66
- `avif_enc.wasm` — 3,564,694 bytes
- `avif_dec.wasm` — 3,640,105 bytes. The decoder currently links the
  full libaom too; a slimmer dav1d-based decode module is a tracked
  size optimisation, not yet done.
