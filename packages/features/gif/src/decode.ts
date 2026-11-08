import { loadModule } from "./module.js";
import type { DecodedGif } from "./types.js";

/**
 * Decodes a GIF into full-canvas RGBA frames. Frames stored as
 * sub-rectangles are composited onto a shared canvas (offsets
 * honoured, keep-disposal semantics — see the README's notes).
 */
export async function decode(data: ArrayBuffer | Uint8Array): Promise<DecodedGif> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length === 0) throw new RangeError("Cannot decode an empty byte buffer.");
  const glue = await loadModule();
  const out = glue.dusrel_gif_decode(bytes);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const width = view.getUint32(0, true);
  const height = view.getUint32(4, true);
  const count = view.getUint32(8, true);
  const repeat = view.getInt32(12, true);
  const frameLength = width * height * 4;
  const frames = [];
  let offset = 16;
  for (let i = 0; i < count; i++) {
    const delay = view.getUint16(offset, true) * 10;
    const pixels = out.slice(offset + 2, offset + 2 + frameLength);
    frames.push({ data: new ImageData(new Uint8ClampedArray(pixels), width, height), delay });
    offset += 2 + frameLength;
  }
  return { width, height, repeat, frames };
}
