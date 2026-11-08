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

  let host: HTMLDivElement | undefined = $state(undefined);
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
    if (!host) return;
    // The element is created imperatively in the main document.
    // Markup-parsed nodes (how Svelte builds templates, via
    // inert fragments) can fail to upgrade in Safari even after
    // the tag is registered — the element sits in the DOM
    // defined-but-unupgraded, with no shadow root and no value.
    // document.createElement always upgrades. The host div is
    // display:contents, so it is invisible to layout.
    const created = document.createElement(
      "dusrel-crop",
    ) as unknown as DusrelCropElement;
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<{ crop: CropRect }>).detail.crop;
      crop = next;
      oncropchange?.(next);
    };
    created.addEventListener("crop-change", onChange);
    host.appendChild(created);
    el = created;
    // Lazy registration keeps imports of this component SSR-safe:
    // the element module extends HTMLElement at module scope.
    void import("@dusrel/image-crop/element").then((mod) => mod.defineCropElement());
    return () => {
      created.removeEventListener("crop-change", onChange);
      created.remove();
      el = undefined;
    };
  });

  // Attributes follow props (imperatively, like the element expects).
  $effect(() => {
    if (!el) return;
    el.setAttribute("src", src);
    if (aspect) el.setAttribute("aspect", aspect);
    else el.removeAttribute("aspect");
    if (shape) el.setAttribute("shape", shape);
    else el.removeAttribute("shape");
    if (className) el.setAttribute("class", className);
    else el.removeAttribute("class");
    if (style) el.setAttribute("style", style);
    else el.removeAttribute("style");
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

<div bind:this={host} style="display:contents"></div>
