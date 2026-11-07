import { loadModule, setCodecAssets } from "./module.js";
import type { CodecAssets, OxipngOptions, ResolvedOxipngOptions } from "./types.js";

const STRIP_CODE = { none: 0, safe: 1, all: 2 } as const;
const INTERLACE_CODE = { keep: -1, off: 0, on: 1 } as const;

/** Applies defaults and validates options (pure; unit tested). */
export function resolveOptions(options: OxipngOptions = {}): ResolvedOxipngOptions {
  const level = options.level ?? 2;
  if (!Number.isInteger(level) || level < 0 || level > 6) {
    throw new RangeError(`level must be an integer between 0 and 6, got ${String(level)}.`);
  }
  const strip = options.strip ?? "safe";
  if (strip !== "none" && strip !== "safe" && strip !== "all") {
    throw new RangeError(`strip must be 'none', 'safe' or 'all', got ${String(strip)}.`);
  }
  const interlace = options.interlace ?? "keep";
  if (interlace !== "keep" && interlace !== "off" && interlace !== "on") {
    throw new RangeError(`interlace must be 'keep', 'off' or 'on', got ${String(interlace)}.`);
  }
  return { level, strip, interlace, force: options.force ?? false };
}

/** Loads and instantiates the WASM ahead of first use. */
export async function init(assetOverrides?: CodecAssets): Promise<void> {
  if (assetOverrides) setCodecAssets(assetOverrides);
  await loadModule();
}

/**
 * Losslessly optimises PNG bytes: same pixels, smaller file.
 * Rejects when the input is not a PNG or cannot be optimised.
 */
export async function optimize(
  data: ArrayBuffer | Uint8Array,
  options: OxipngOptions = {},
): Promise<ArrayBuffer> {
  const resolved = resolveOptions(options);
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const glue = await loadModule();
  if (!glue.dusrel_oxipng_optimize) {
    throw new Error("OxiPNG glue is missing dusrel_oxipng_optimize.");
  }
  const out = glue.dusrel_oxipng_optimize(
    bytes,
    resolved.level,
    STRIP_CODE[resolved.strip],
    INTERLACE_CODE[resolved.interlace],
    resolved.force,
  );
  return out.buffer as ArrayBuffer;
}
