import { loadModule } from "./module.js";
import type { GifEncodeOptions, GifFrameInput, ResolvedGifEncodeOptions } from "./types.js";

/** Applies defaults and validates encode options (pure; unit tested). */
export function resolveEncodeOptions(options: GifEncodeOptions = {}): ResolvedGifEncodeOptions {
  const repeat = options.repeat ?? 0;
  if (!Number.isInteger(repeat) || repeat < -1) {
    throw new RangeError(`repeat must be -1, 0 or a positive integer, got ${repeat}.`);
  }
  const speed = options.speed ?? 10;
  if (!Number.isInteger(speed) || speed < 1 || speed > 30) {
    throw new RangeError(`speed must be an integer in 1..30, got ${speed}.`);
  }
  const palette = options.palette ?? "per-frame";
  if (palette !== "per-frame" && palette !== "global") {
    throw new RangeError(`palette must be "per-frame" or "global", got ${String(palette)}.`);
  }
  return { repeat, speed, palette };
}

const DEFAULT_DELAY_MS = 100;

/** Converts a millisecond delay to the GIF format's centisecond unit (pure; unit tested). */
export function delayToCentiseconds(delayMs: number): number {
  if (typeof delayMs !== "number" || Number.isNaN(delayMs) || delayMs < 0) {
    throw new RangeError(`delay must be a non-negative number of milliseconds, got ${delayMs}.`);
  }
  return Math.min(65535, Math.round(delayMs / 10));
}

/**
 * Encodes same-sized RGBA frames into an animated GIF with the Rust
 * `gif` crate. GIF colour is palette-based (<= 256 colours per
 * palette) and alpha is binary: fully transparent pixels become the
 * transparent slot, everything else is opaque.
 */
export async function encode(
  frames: GifFrameInput[],
  options: GifEncodeOptions = {},
): Promise<Uint8Array> {
  const { repeat, speed, palette } = resolveEncodeOptions(options);
  if (frames.length === 0) throw new RangeError("encode needs at least one frame.");
  const first = frames[0] as GifFrameInput;
  const { width, height } = first.data;
  const frameLength = width * height * 4;
  const all = new Uint8Array(frames.length * frameLength);
  const delays = new Uint8Array(frames.length * 2);
  frames.forEach((frame, i) => {
    if (frame.data.width !== width || frame.data.height !== height) {
      throw new RangeError(
        `frame ${i} is ${frame.data.width}x${frame.data.height}; all frames must match the first (${width}x${height}).`,
      );
    }
    if (frame.data.data.length !== frameLength) {
      throw new RangeError(`frame ${i} data length does not match ${width}x${height} RGBA.`);
    }
    all.set(frame.data.data, i * frameLength);
    const cs = delayToCentiseconds(frame.delay ?? DEFAULT_DELAY_MS);
    delays[i * 2] = cs & 0xff;
    delays[i * 2 + 1] = (cs >> 8) & 0xff;
  });
  const glue = await loadModule();
  return glue.dusrel_gif_encode(width, height, all, delays, repeat, speed, palette === "global");
}
