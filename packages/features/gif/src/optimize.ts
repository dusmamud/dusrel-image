import { decode } from "./decode.js";
import { encode } from "./encode.js";
import type { GifOptimizeOptions } from "./types.js";

/**
 * Optimises an existing GIF by decoding it and re-encoding with
 * fresh settings — a shared global palette and/or a faster
 * quantisation speed are the usual wins (the gifsicle-style
 * workflow, on a permissive engine). Delays and the loop count
 * are preserved unless overridden.
 */
export async function optimize(
  data: ArrayBuffer | Uint8Array,
  options: GifOptimizeOptions = {},
): Promise<Uint8Array> {
  const decoded = await decode(data);
  const frames = decoded.frames.map((frame) => ({
    data: frame.data,
    delay: options.delay ?? frame.delay,
  }));
  return encode(frames, {
    repeat: options.repeat ?? decoded.repeat,
    ...(options.speed !== undefined ? { speed: options.speed } : {}),
    ...(options.palette !== undefined ? { palette: options.palette } : {}),
  });
}
