/** Structural pixel container (DOM ImageData's shape; see @dusrel/image-transform). */
export interface PixelData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type WatermarkPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center"
  | "tile";

export interface WatermarkOptions {
  /** Default 'bottom-right'. 'tile' repeats the mark across the image. */
  position?: WatermarkPosition;
  /** Global mark opacity, 0..1. Default 0.7. */
  opacity?: number;
  /**
   * Mark width as a fraction of the image width (image marks).
   * Default 0.2. The mark's aspect ratio is preserved.
   */
  scale?: number;
  /** Margin in px from the image edge (positioned modes). Default 16. */
  margin?: number;
  /** Extra gap in px between tiles ('tile' mode). Default: one mark width. */
  tileGap?: number;
  /** Text marks: CSS font string. Default '600 24px sans-serif'. */
  font?: string;
  /** Text marks: CSS colour. Default '#ffffff'. */
  color?: string;
}

export interface ResolvedWatermarkOptions {
  position: WatermarkPosition;
  opacity: number;
  scale: number;
  margin: number;
  tileGap: number | undefined;
  font: string;
  color: string;
}

export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}
