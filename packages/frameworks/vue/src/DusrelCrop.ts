import { defineComponent, h, onMounted, onUnmounted, ref, watch, type PropType } from "vue";
import type { DusrelCropElement } from "@dusrel/image-crop/element";
import type { CropRect } from "@dusrel/image-crop";

export interface DusrelCropProps {
  src: string;
  aspect?: string;
  shape?: "rect" | "circle";
  modelValue?: CropRect;
}

/**
 * Vue wrapper for the <dusrel-crop> Web Component from
 * @dusrel/image-crop. Supports v-model with the crop rect
 * (natural pixels): setting it calls the element's setCrop(),
 * and every crop-change emits update:modelValue + crop-change.
 * The element module is imported lazily on mount, so importing
 * this component during SSR is safe. The element itself is
 * reachable via a template ref's `element()` method.
 */
export const DusrelCrop = defineComponent({
  name: "DusrelCrop",
  props: {
    src: { type: String, required: true },
    aspect: { type: String, default: undefined },
    shape: { type: String as PropType<"rect" | "circle">, default: undefined },
    modelValue: { type: Object as PropType<CropRect | undefined>, default: undefined },
  },
  emits: {
    "crop-change": (_crop: CropRect) => true,
    "update:modelValue": (_crop: CropRect) => true,
  },
  setup(props, { emit, expose }) {
    const elRef = ref<DusrelCropElement | null>(null);
    let applyingModel = false;

    const applyAttrs = () => {
      const el = elRef.value;
      if (!el) return;
      el.setAttribute("src", props.src);
      if (props.aspect) el.setAttribute("aspect", props.aspect);
      else el.removeAttribute("aspect");
      if (props.shape) el.setAttribute("shape", props.shape);
      else el.removeAttribute("shape");
    };

    const onChange = (event: Event) => {
      const crop = (event as CustomEvent<{ crop: CropRect }>).detail.crop;
      emit("crop-change", crop);
      if (!applyingModel) emit("update:modelValue", crop);
    };

    onMounted(() => {
      const el = elRef.value;
      if (!el) return;
      el.addEventListener("crop-change", onChange);
      applyAttrs();
      void import("@dusrel/image-crop/element").then((mod) => mod.defineCropElement());
    });
    onUnmounted(() => {
      elRef.value?.removeEventListener("crop-change", onChange);
    });

    watch(() => [props.src, props.aspect, props.shape], applyAttrs);
    watch(
      () => props.modelValue,
      (rect) => {
        const el = elRef.value;
        if (!el || !rect) return;
        const cur = el.value;
        if (
          cur.x !== rect.x ||
          cur.y !== rect.y ||
          cur.width !== rect.width ||
          cur.height !== rect.height
        ) {
          applyingModel = true;
          el.setCrop(rect);
          applyingModel = false;
        }
      },
    );

    expose({ element: () => elRef.value });

    return () => h("dusrel-crop", { ref: elRef });
  },
});
