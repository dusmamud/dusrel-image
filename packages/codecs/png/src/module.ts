/**
 * Lazy wasm-bindgen module loading (the Rust codecs' glue differs
 * from the Emscripten one: an async init(bytes) plus named exports).
 * Nothing is fetched until first use, so importing this package
 * costs no network and no WASM compile.
 */
import type { CodecAssets } from "./types.js";

export interface BindgenPngGlue {
  default: (input: { module_or_path: BufferSource }) => Promise<unknown>;
  dusrel_png_encode?: (
    rgba: Uint8Array,
    width: number,
    height: number,
    compression: number,
    filter: number,
  ) => Uint8Array;
  dusrel_png_decode?: (data: Uint8Array) => Uint8Array;
}

let assets: CodecAssets = {};
const cache = new Map<"enc" | "dec", Promise<BindgenPngGlue>>();

/** Overrides where the codec assets are loaded from. May be called at any time; the codec reloads from the new URLs on next use. */
export function setCodecAssets(next: CodecAssets): void {
  assets = { ...assets, ...next };
  cache.clear();
}

function defaultAssetUrl(kind: "enc" | "dec", ext: "js" | "wasm"): string {
  return new URL(`../codec/png_${kind}.${ext}`, import.meta.url).href;
}

export function loadModule(kind: "enc" | "dec"): Promise<BindgenPngGlue> {
  const cached = cache.get(kind);
  if (cached) return cached;
  const promise = (async () => {
    const jsUrl =
      (kind === "enc" ? assets.encodeJsUrl : assets.decodeJsUrl) ?? defaultAssetUrl(kind, "js");
    const wasmUrl =
      (kind === "enc" ? assets.encodeWasmUrl : assets.decodeWasmUrl) ??
      defaultAssetUrl(kind, "wasm");
    const glue = (await import(/* @vite-ignore */ jsUrl)) as BindgenPngGlue;
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error(`Failed to fetch PNG codec WASM from ${wasmUrl}.`);
    await glue.default({ module_or_path: await response.arrayBuffer() });
    return glue;
  })();
  cache.set(kind, promise);
  return promise;
}
