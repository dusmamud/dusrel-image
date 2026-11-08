# @dusrel/image-react

Thin React bindings for the @dusrel/image family — hooks and a
typed crop component. UI state only; all processing stays in
the core pipeline.

```bash
npm install @dusrel/image-react react
```

## useProcessImage

```tsx
import { useProcessImage } from '@dusrel/image-react';

function Compressor() {
  const { process, processing, progress, result, error, reset } = useProcessImage();
  return (
    <>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void process(f, { format: 'image/webp', quality: 0.8, resize: { width: 1600 } });
        }}
      />
      {processing && <progress value={progress} max={1} />}
      {result && <img src={URL.createObjectURL(result.blob)} alt="" />}
      {error && <p role="alert">{String(error)}</p>}
      <button onClick={reset}>Reset</button>
    </>
  );
}
```

State: `status` (`idle | processing | success | error`), the
pipeline `step` + coarse `progress` (0.25 per step), `result`
(the `ImageResult` from @dusrel/image), and `error` (captured,
never thrown). A newer `process()` supersedes an in-flight run;
`abort()` cancels back to idle; unmount aborts automatically.

`useProcessBatch` is the same shape over `processBatch`, with
`completed` / `total` counts and a derived `progress` fraction.

## <DusrelCrop>

A typed wrapper around the `<dusrel-crop>` Web Component:

```tsx
import { DusrelCrop } from '@dusrel/image-react';
import type { CropRect } from '@dusrel/image-crop';

const [crop, setCrop] = useState<CropRect>();
<DusrelCrop src={url} aspect="16/9" onCropChange={setCrop} style={{ width: 640, height: 400 }} />
```

The ref exposes the element itself (`.value`, `.setCrop()`,
`.zoomIn()`…). Attributes are set imperatively (React 18/19
parity) and the element module loads lazily in an effect, so
importing the component during SSR is safe.

## Framework-free cores

`createProcessor()` / `createBatchProcessor()` are the plain
stores the hooks sit on — injectable process functions,
subscribable state. Useful for tests and non-React bindings.

## Status

Implemented (Phase 4). The stores are unit-tested in Node with
injected fakes; the bindings are proven in the Playwright suite
with a real mounted React app in Chromium, Firefox and WebKit.
