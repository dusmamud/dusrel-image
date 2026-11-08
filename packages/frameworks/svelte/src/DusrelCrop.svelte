<script lang="ts">
  import { onMount } from "svelte";
  import type { DusrelCropElement } from "@dusrel/image-crop/element";
  import type { CropRect } from "@dusrel/image-crop";

  export interface DusrelCropProps {
    /** Image URL (any <img> source, including blob: and data: URLs). */
    src: string;
    /** Aspect lock, e.g. "16/9" or "1.5". Omit for a free crop. */
    aspect?: string;
    /** Crop shape. Default "rect"; "circle" forces a square crop. */
    shape?: "rect" | "circle";
    /** The crop in natural pixels — bindable (bind:crop). */
    crop?: CropRect | undefined;
    /** Called with the crop on load and after every interaction. */
    oncropchange?: (crop: CropRect) => void;
    class?: string;
    style?: string;
  }

  let {
    src,
    aspect,
    shape,
    crop = $bindable(),
    oncropchange,
    class: className,
    style,
  }: DusrelCropProps = $props();

  let el: DusrelCropElement | undefined = $state(undefined);
  let applyingExternal = false;

  function sameRect(a: CropRect | undefined, b: CropRect | undefined): boolean {
    return (
      a !== undefined &&
      b !== undefined &&
      a.x === b.x &&
      a.y === b.y &&
      a.width === b.width &&
      a.height === b.height
    );
  }

  onMount(() => {
    if (!el) return;
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<{ crop: CropRect }>).detail.crop;
      crop = next;
      oncropchange?.(next);
    };
    el.addEventListener("crop-change", onChange);
    // Lazy registration keeps imports of this component SSR-safe:
    // the element module extends HTMLElement at module scope.
    void import("@dusrel/image-crop/element").then((mod) => mod.defineCropElement());
    return () => el?.removeEventListener("crop-change", onChange);
  });

  // Attributes follow props (imperatively, like the element expects).
  $effect(() => {
    if (!el) return;
    el.setAttribute("src", src);
    if (aspect) el.setAttribute("aspect", aspect);
    else el.removeAttribute("aspect");
    if (shape) el.setAttribute("shape", shape);
    else el.removeAttribute("shape");
  });

  // External crop sets (parent writes bind:crop) drive the element.
  $effect(() => {
    if (!el || !crop || applyingExternal) return;
    if (!sameRect(el.value, crop)) {
      applyingExternal = true;
      el.setCrop(crop);
      applyingExternal = false;
    }
  });

  /** The underlying <dusrel-crop> element (value, setCrop, zoomIn, …). */
  export function getElement(): DusrelCropElement | undefined {
    return el;
  }
</script>

<dusrel-crop bind:this={el} class={className} {style}></dusrel-crop>
