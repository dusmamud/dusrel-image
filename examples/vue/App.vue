<script setup>
import { ref } from "vue";
import { processImage } from "@dusrel/image";

// Vue example: pick a file, process it entirely client-side,
// preview + download the result, and show the process report.
const result = ref(null);
const busy = ref(false);

async function onFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  busy.value = true;
  try {
    const { blob, report } = await processImage(file, {
      format: "image/webp",
      quality: 0.82,
      resize: { width: 1600 },
    });
    result.value = { url: URL.createObjectURL(blob), size: blob.size, report };
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main>
    <h1>@dusrel/image — Vue</h1>
    <input type="file" accept="image/*" :disabled="busy" @change="onFile" />
    <figure v-if="result">
      <img :src="result.url" alt="Processed" style="max-width: 100%" />
      <figcaption>
        {{ result.size }} bytes · steps: {{ result.report.stepsApplied.join(", ") }} ·
        <a :href="result.url" download="processed.webp">Download</a>
      </figcaption>
    </figure>
  </main>
</template>
