import type { Component } from "svelte";
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

/** Svelte 5 wrapper for the <dusrel-crop> Web Component. */
declare const DusrelCrop: Component<DusrelCropProps>;
export default DusrelCrop;
