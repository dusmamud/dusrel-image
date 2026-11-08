/**
 * Lazy wasm-bindgen module loading. Nothing is fetched until first
 * use, so importing this package costs no network and no WASM
 * compile. The gif engine is a single module (encode + decode).
 */
import type { CodecAssets } from "./types.js";

export interface BindgenGifGlue {
  default: (input: { module_or_path: BufferSource }) => Promise<unknown>;
  dusrel_gif_encode: (
    width: number,
    height: number,
    framesRgba: Uint8Array,
    delaysCs: Uint8Array,
    repeat: number,
    speed: number,
    globalPalette: boolean,
  ) => Uint8Array;
  dusrel_gif_decode: (data: Uint8Array) => Uint8Array;
}

let assets: CodecAssets = {};
let cached: Promise<BindgenGifGlue> | undefined;

/** Overrides where the codec assets are loaded from. Call before first use. */
export function setCodecAssets(next: CodecAssets): void {
  assets = { ...assets, ...next };
  cached = undefined;
}

function defaultAssetUrl(ext: "js" | "wasm"): string {
  return new URL(`../codec/gif.${ext}`, import.meta.url).href;
}

export function loadModule(): Promise<BindgenGifGlue> {
  if (cached) return cached;
  const promise = (async () => {
    const jsUrl = assets.jsUrl ?? defaultAssetUrl("js");
    const wasmUrl = assets.wasmUrl ?? defaultAssetUrl("wasm");
    const glue = (await import(/* @vite-ignore */ jsUrl)) as BindgenGifGlue;
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error(`Failed to fetch GIF codec WASM from ${wasmUrl}.`);
    await glue.default({ module_or_path: await response.arrayBuffer() });
    return glue;
  })();
  cached = promise;
  return promise;
}

/** Loads and instantiates the codec WASM ahead of first use. */
export async function init(assetOverrides?: CodecAssets): Promise<void> {
  if (assetOverrides) setCodecAssets(assetOverrides);
  await loadModule();
}
