/**
 * Lazy wasm-bindgen module loading. Nothing is fetched until first
 * use, so importing this package costs no network and no WASM
 * compile.
 */
import type { CodecAssets } from "./types.js";

export interface BindgenResizeGlue {
  default: (input: { module_or_path: BufferSource }) => Promise<unknown>;
  dusrel_resize?: (
    rgba: Uint8Array,
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number,
    filter: number,
    premultiply: boolean,
  ) => Uint8Array;
}

let assets: CodecAssets = {};
let cached: Promise<BindgenResizeGlue> | undefined;

/** Overrides where the codec assets are loaded from. Call before first use. */
export function setCodecAssets(next: CodecAssets): void {
  assets = { ...assets, ...next };
  cached = undefined;
}

export function loadModule(): Promise<BindgenResizeGlue> {
  if (cached) return cached;
  cached = (async () => {
    const jsUrl = assets.jsUrl ?? new URL("../codec/resize.js", import.meta.url).href;
    const wasmUrl = assets.wasmUrl ?? new URL("../codec/resize.wasm", import.meta.url).href;
    const glue = (await import(/* @vite-ignore */ jsUrl)) as BindgenResizeGlue;
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error(`Failed to fetch resize codec WASM from ${wasmUrl}.`);
    await glue.default({ module_or_path: await response.arrayBuffer() });
    return glue;
  })();
  return cached;
}
