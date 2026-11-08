# @dusrel/image-svelte

Thin Svelte 5 bindings for the @dusrel/image family — store
factories for processing (single + batch) and a DusrelCrop
component. UI state only; all processing stays in the core
pipeline.

```bash
npm install @dusrel/image-svelte svelte
```

## createProcessImage

```svelte
<script>
  import { createProcessImage } from '@dusrel/image-svelte';

  const { process, status, progress, result, error, reset } = createProcessImage();
</script>

<input
  type="file"
  accept="image/*"
  onchange={(e) => {
    const f = e.currentTarget.files?.[0];
    if (f) void process(f, { format: 'image/webp', quality: 0.8, resize: { width: 1600 } });
  }}
/>
{#if $status === 'processing'}<progress value={$progress} max="1"></progress>{/if}
{#if $result}<img src={URL.createObjectURL($result.blob)} alt="" />{/if}
{#if $error}<p role="alert">{String($error)}</p>{/if}
```

The factories return plain Svelte stores (`state`, `status`,
`progress`, `result`, `error`, `processing`) plus `process` /
`abort` / `reset`. Errors are captured in the `error` store,
never thrown; a newer `process()` supersedes an in-flight run.
`createProcessBatch` is the same shape over `processBatch`,
with progress derived from settled counts.

## <DusrelCrop>

Ships as Svelte source (your toolchain compiles it, as is
standard for Svelte libraries):

```svelte
<script>
  import DusrelCrop from '@dusrel/image-svelte/DusrelCrop.svelte';
  let crop;
</script>

<DusrelCrop bind:crop src={url} aspect="16/9" style="width: 640px; height: 400px" />
```

`crop` is a bindable prop in natural pixels — external writes
call the element's `setCrop()`, interactions update the
binding — and `oncropchange` fires alongside. `getElement()`
exposes the underlying `<dusrel-crop>` element. The element
module registers lazily on mount, so SSR imports are safe.

## Framework-free cores

`createProcessor()` / `createBatchProcessor()` are the plain
stores underneath — injectable process functions, subscribable
state. Useful for tests and non-Svelte bindings.

## Status

Implemented (Phase 4). Stores are unit-tested in Node; the
component is gated by the real Svelte compiler in unit tests
and mount-proven in the Playwright suite in Chromium, Firefox
and WebKit (the test fixture compiles it with the package's
own pre-compile script, since bundlers can't compile .svelte).
