<script setup lang="ts">
import { processImage } from "@dusrel/image";

// Nuxt example: wrap usage in <ClientOnly> (or name the
// component *.client.vue) — the family is browser-only.
const url = ref<string | null>(null);
const info = ref("");

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const { blob, report } = await processImage(file, {
    format: "image/webp",
    quality: 0.82,
    resize: { width: 1600 },
  });
  url.value = URL.createObjectURL(blob);
  info.value = `${file.size} → ${blob.size} bytes · ${report.stepsApplied.join(", ")}`;
}
</script>

<template>
  <ClientOnly>
    <div>
      <h1>@dusrel/image — Nuxt</h1>
      <input type="file" accept="image/*" @change="onFile" />
      <figure v-if="url">
        <img :src="url" alt="Processed" style="max-width: 100%" />
        <figcaption>{{ info }}</figcaption>
      </figure>
    </div>
  </ClientOnly>
</template>
