import { placementsFor, resolveWatermarkOptions } from "./layout.js";
import type { PixelData, WatermarkOptions } from "./types.js";

/**
 * Draws a text watermark via the platform canvas. The text is
 * measured first, then the shared layout maths places it (or
 * tiles it) exactly like an image mark of the text's size.
 * Browser/worker only (needs a 2D canvas).
 */
export function drawTextWatermark(
  image: PixelData,
  text: string,
  options: WatermarkOptions = {},
): PixelData {
  if (typeof text !== "string" || text.length === 0) {
    throw new RangeError("text must be a non-empty string.");
  }
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("drawTextWatermark needs OffscreenCanvas in this environment.");
  }
  const resolved = resolveWatermarkOptions(options);

  // Measure with a probe canvas using the final font.
  const probe = new OffscreenCanvas(1, 1).getContext("2d");
  if (!probe) throw new Error("2d context unavailable for text watermark.");
  probe.font = resolved.font;
  const metrics = probe.measureText(text);
  const textWidth = Math.max(1, Math.ceil(metrics.width));
  const fontSize = Number(/(\d+(?:\.\d+)?)px/.exec(resolved.font)?.[1] ?? 24);
  const textHeight = Math.max(1, Math.ceil(fontSize * 1.2));

  const out = new OffscreenCanvas(image.width, image.height);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable for text watermark.");
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
    0,
    0,
  );

  // Same rule as image marks: the placement width is
  // imageWidth * scale, the height follows the text's measured
  // aspect, and the font is drawn scaled to fit the placement.
  const placements = placementsFor(image.width, image.height, textWidth / textHeight, resolved);
  ctx.fillStyle = resolved.color;
  ctx.textBaseline = "top";
  for (const placement of placements) {
    const factor = placement.width / textWidth;
    ctx.save();
    ctx.globalAlpha = resolved.opacity;
    ctx.translate(placement.x, placement.y);
    ctx.scale(factor, factor);
    ctx.font = resolved.font;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  const result = ctx.getImageData(0, 0, image.width, image.height);
  return { data: result.data, width: result.width, height: result.height };
}
