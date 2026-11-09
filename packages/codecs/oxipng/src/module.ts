/**
 * Lazy wasm-bindgen module loading. Nothing is fetched until first
 * use, so importing this package costs no network and no WASM
 * compile. An optimiser has a single module (no encode/decode
 * split like the codecs).
 */
import type { CodecAssets } from "./types.js";

export interface BindgenOxipngGlue {
  default: (input: { module_or_path: BufferSource }) => Promise<unknown>;
  dusrel_oxipng_optimize?: (
    data: Uint8Array,
    level: number,
    strip: number,
    interlace: number,
    force: boolean,
  ) => Uint8Array;
}

let assets: CodecAssets = {};
let cached: Promise<BindgenOxipngGlue> | undefined;

/** Overrides where the codec assets are loaded from. May be called at any time; the codec reloads from the new URLs on next use. */
export function setCodecAssets(next: CodecAssets): void {
  assets = { ...assets, ...next };
  cached = undefined;
}

export function loadModule(): Promise<BindgenOxipngGlue> {
  if (cached) return cached;
  cached = (async () => {
    const jsUrl = assets.jsUrl ?? new URL("../codec/oxipng.js", import.meta.url).href;
    const wasmUrl = assets.wasmUrl ?? new URL("../codec/oxipng.wasm", import.meta.url).href;
    const glue = (await import(/* @vite-ignore */ jsUrl)) as BindgenOxipngGlue;
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error(`Failed to fetch OxiPNG codec WASM from ${wasmUrl}.`);
    await glue.default({ module_or_path: await response.arrayBuffer() });
    return glue;
  })();
  return cached;
}
