/**
 * @dusrel/image-crop
 *
 * Interactive cropping for the @dusrel/image family, split the
 * way the whole family is split: a pure geometry core (this
 * entry — clamping, aspect locks, handle maths, display/natural
 * mapping, all unit-tested) and an accessible Web Component in
 * the './element' entry that renders it. The component returns
 * geometry only; @dusrel/image-core applies it.
 */
export {
  clampCrop,
  displayToNatural,
  effectiveAspect,
  fitRect,
  initialCrop,
  moveCrop,
  naturalToDisplay,
  resizeCrop,
  type CropConstraints,
  type CropRect,
  type CropShape,
  type ResizeHandle,
  type Size,
} from "./geometry.js";
