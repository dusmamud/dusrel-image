// Browser-test fixture: a real Vue app using the package's
// composable + crop component, bundled self-contained by
// tsdown (see tsdown.config.ts) and mounted by
// tests/browser/vue.spec.ts.
import { createApp, defineComponent, h, onMounted, ref } from "vue";
import { DusrelCrop, useProcessImage } from "../src/index.js";
import type { CropRect } from "@dusrel/image-crop";

const App = defineComponent({
  setup() {
    const { process, status, result, error } = useProcessImage();
    const blob = ref<Blob | undefined>(undefined);
    const src = ref("");
    const crop = ref<CropRect | undefined>(undefined);

    onMounted(async () => {
      const canvas = new OffscreenCanvas(800, 600);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "rgb(30, 100, 200)";
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = "rgb(250, 200, 40)";
      ctx.fillRect(400, 0, 400, 600);
      const b = await canvas.convertToBlob({ type: "image/png" });
      src.value = URL.createObjectURL(b);
      blob.value = b;
    });

    return () =>
      h("main", [
        src.value
          ? h(DusrelCrop, {
              src: src.value,
              style: { width: "400px", height: "300px", display: "block" },
              "onCrop-change": (c: CropRect) => {
                crop.value = c;
              },
            })
          : null,
        h("div", { "data-testid": "crop" }, crop.value ? JSON.stringify(crop.value) : "none"),
        h(
          "button",
          {
            "data-testid": "go",
            disabled: !blob.value,
            onClick: () => {
              if (blob.value) {
                void process(blob.value, {
                  format: "image/webp",
                  quality: 0.8,
                  ...(crop.value ? { crop: crop.value } : {}),
                });
              }
            },
          },
          "Process",
        ),
        h("div", { "data-testid": "status" }, status.value),
        h(
          "div",
          { "data-testid": "result" },
          result.value
            ? `${result.value.blob.type}:${result.value.blob.size}:${result.value.report.stepsApplied.join(",")}`
            : error.value
              ? `error:${String(error.value)}`
              : "none",
        ),
      ]);
  },
});

createApp(App).mount("#root");
