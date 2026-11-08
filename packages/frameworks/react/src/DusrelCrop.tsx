import { createElement, forwardRef, useEffect, useRef, type CSSProperties } from "react";
import type { DusrelCropElement } from "@dusrel/image-crop/element";
import type { CropRect } from "@dusrel/image-crop";

export interface DusrelCropProps {
  /** Image URL (any <img> source, including blob: and data: URLs). */
  src: string;
  /** Aspect lock, e.g. "16/9" or "1.5". Omit for a free crop. */
  aspect?: string;
  /** Crop shape. Default "rect"; "circle" forces a square crop with a round mask. */
  shape?: "rect" | "circle";
  /** Fires with the crop (natural pixels) on load and after every interaction. */
  onCropChange?: (crop: CropRect) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * React wrapper for the <dusrel-crop> Web Component from
 * @dusrel/image-crop. The ref gives you the element itself
 * (`.value`, `.setCrop()`, `.zoomIn()`, …). Attributes are set
 * imperatively, so behaviour is identical on React 18 and 19,
 * and the element module is imported lazily inside an effect —
 * importing this component during SSR is safe.
 */
export const DusrelCrop = forwardRef<DusrelCropElement, DusrelCropProps>(function DusrelCrop(
  { src, aspect, shape, onCropChange, className, style },
  forwardedRef,
) {
  const innerRef = useRef<DusrelCropElement | null>(null);
  const callbackRef = useRef(onCropChange);
  callbackRef.current = onCropChange;

  // Register the element once (lazy import keeps SSR imports safe:
  // the element module extends HTMLElement at module scope).
  useEffect(() => {
    let live = true;
    void import("@dusrel/image-crop/element").then((mod) => {
      if (live) mod.defineCropElement();
    });
    return () => {
      live = false;
    };
  }, []);

  // crop-change → callback (listener attaches before registration
  // completes too; the element only emits after its image loads).
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const onChange = (event: Event) => {
      callbackRef.current?.((event as CustomEvent<{ crop: CropRect }>).detail.crop);
    };
    el.addEventListener("crop-change", onChange);
    return () => el.removeEventListener("crop-change", onChange);
  }, []);

  // Attributes, set imperatively for React 18/19 parity.
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.setAttribute("src", src);
    if (aspect) el.setAttribute("aspect", aspect);
    else el.removeAttribute("aspect");
    if (shape) el.setAttribute("shape", shape);
    else el.removeAttribute("shape");
  }, [src, aspect, shape]);

  return createElement("dusrel-crop", {
    ref: (el: DusrelCropElement | null) => {
      innerRef.current = el;
      if (typeof forwardedRef === "function") forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    },
    className,
    style,
  });
});
