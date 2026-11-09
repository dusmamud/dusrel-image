# Frameworks

React, Vue and Svelte each get a first-class package. All three
wrap the same framework-free processor store, so the state model
is identical everywhere: `status` (`idle | processing | success | error`),
`progress` (0..1), `result`, `error`, `reset()` — plus a typed
crop component.

## React — `@dusrel/image-react`

```bash
npm install @dusrel/image-react react
```

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
      {error != null && <p role="alert">{String(error)}</p>}
      <button onClick={reset}>Reset</button>
    </>
  );
}
```

`useProcessBatch()` is the batch counterpart (state carries
`completed`, `total` and per-item `results`). A newer `process()`
call supersedes an in-flight one — stale results never land.

The crop component:

```tsx
import { DusrelCrop } from '@dusrel/image-react';

<DusrelCrop src={url} aspect="16/9" shape="rect" onCropChange={(crop) => setCrop(crop)} />
```

## Vue — `@dusrel/image-vue`

```bash
npm install @dusrel/image-vue vue
```

```vue
<script setup>
import { useProcessImage } from '@dusrel/image-vue';

const { process, processing, progress, result, error, reset } = useProcessImage();

function onFile(e) {
  const f = e.target.files?.[0];
  if (f) void process(f, { format: 'image/webp', quality: 0.8, resize: { width: 1600 } });
}
</script>

<template>
  <input type="file" accept="image/*" @change="onFile" />
  <progress v-if="processing" :value="progress" max="1" />
  <p v-if="error" role="alert">{{ String(error) }}</p>
  <button @click="reset">Reset</button>
</template>
```

`DusrelCrop` supports `v-model` for the crop rect, with the same
`src` / `aspect` / `shape` props.

## Svelte — `@dusrel/image-svelte`

```bash
npm install @dusrel/image-svelte svelte
```

Svelte 5 runes under the hood; the factory returns stores you
subscribe to with `$`:

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

`DusrelCrop.svelte` ships as `.svelte` source so your own Svelte
toolchain compiles it with the rest of your app.

## Framework-free

Every wrapper is a thin bridge over `createProcessor()` /
`createBatchProcessor()` from `@dusrel/image` — if your framework
isn't covered, subscribe to the store yourself; its shape is the
same state described above.
