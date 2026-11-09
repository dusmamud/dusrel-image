/**
 * Lazy wasm-bindgen module loading. Nothing is fetched until first
 * use, so importing this package costs no network and no WASM
 * compile.
 */
import type { CodecAssets } from "./types.js";

export interface BindgenQuantizeGlue {
  default: (input: { module_or_path: BufferSource }) => Promise<unknown>;
  dusrel_quantize?: (
    rgba: Uint8Array,
    width: number,
    height: number,
    maxColors: number,
    dithering: number,
  ) => Uint8Array;
}

let assets: CodecAssets = {};
let cached: Promise<BindgenQuantizeGlue> | undefined;

/** Overrides where the codec assets are loaded from. May be called at any time; the codec reloads from the new URLs on next use. */
export function setCodecAssets(next: CodecAssets): void {
  assets = { ...assets, ...next };
  cached = undefined;
}

export function loadModule(): Promise<BindgenQuantizeGlue> {
  if (cached) return cached;
  cached = (async () => {
    const jsUrl = assets.jsUrl ?? new URL("../codec/quantize.js", import.meta.url).href;
    const wasmUrl = assets.wasmUrl ?? new URL("../codec/quantize.wasm", import.meta.url).href;
    const glue = (await import(/* @vite-ignore */ jsUrl)) as BindgenQuantizeGlue;
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error(`Failed to fetch quantize codec WASM from ${wasmUrl}.`);
    await glue.default({ module_or_path: await response.arrayBuffer() });
    return glue;
  })();
  return cached;
}
