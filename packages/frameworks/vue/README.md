# @dusrel/image-vue

Thin Vue 3 bindings for the @dusrel/image family — composables
and a crop component with v-model support. UI state only; all
processing stays in the core pipeline.

```bash
npm install @dusrel/image-vue vue
```

## useProcessImage

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

State is reactive refs/computeds: `status`
(`idle | processing | success | error`), the pipeline `step` +
coarse `progress` (0.25 per step), `result`, and `error`
(captured, never thrown). A newer `process()` supersedes an
in-flight run; `abort()` cancels back to idle; unmount aborts
automatically. `useProcessBatch` is the same shape over
`processBatch`, with settled-count progress.

## <DusrelCrop>

```vue
<script setup>
import { DusrelCrop } from '@dusrel/image-vue';
const crop = ref();
</script>

<template>
  <DusrelCrop v-model="crop" :src="url" aspect="16/9" style="width: 640px; height: 400px" />
</template>
```

v-model carries the crop rect in natural pixels both ways:
setting it calls the element's `setCrop()`, and every
interaction emits `update:modelValue` (plus a plain
`crop-change` event). The element itself is reachable through
a template ref's `element()` method. The Web Component module
loads lazily on mount, so SSR imports are safe.

## Framework-free cores

`createProcessor()` / `createBatchProcessor()` are the plain
stores the composables sit on — injectable process functions,
subscribable state. Useful for tests and non-Vue bindings.

## Status

Implemented (Phase 4). Stores + composables are unit-tested in
Node (Vue reactivity runs headless); the component is proven
in the Playwright suite with a real mounted Vue app in
Chromium, Firefox and WebKit.
