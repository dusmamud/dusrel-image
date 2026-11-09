/**
 * Lazy Emscripten module loading. Nothing is fetched or instantiated
 * until the first encode/decode call (or an explicit init), so merely
 * importing this package costs no network and no WASM compile.
 */
import type { CodecAssets } from "./types.js";

export interface EmscriptenCodecModule {
  cwrap: (name: string, returnType: string, argTypes: string[]) => (...args: number[]) => number;
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
}

type ModuleFactory = (options: {
  locateFile?: (path: string, prefix: string) => string;
}) => Promise<EmscriptenCodecModule>;

let assets: CodecAssets = {};
const cache = new Map<"enc" | "dec", Promise<EmscriptenCodecModule>>();

/** Overrides where the codec assets are loaded from. May be called at any time; the codec reloads from the new URLs on next use. */
export function setCodecAssets(next: CodecAssets): void {
  assets = { ...assets, ...next };
  cache.clear();
}

function defaultAssetUrl(kind: "enc" | "dec", ext: "js" | "wasm"): string {
  return new URL(`../codec/webp_${kind}.${ext}`, import.meta.url).href;
}

export function loadModule(kind: "enc" | "dec"): Promise<EmscriptenCodecModule> {
  const cached = cache.get(kind);
  if (cached) return cached;
  const promise = (async () => {
    const jsUrl =
      (kind === "enc" ? assets.encodeJsUrl : assets.decodeJsUrl) ?? defaultAssetUrl(kind, "js");
    const wasmUrl =
      (kind === "enc" ? assets.encodeWasmUrl : assets.decodeWasmUrl) ??
      defaultAssetUrl(kind, "wasm");
    const factory = ((await import(/* @vite-ignore */ jsUrl)) as { default: ModuleFactory })
      .default;
    return factory({
      locateFile: (path) => (path.endsWith(".wasm") ? wasmUrl : path),
    });
  })();
  cache.set(kind, promise);
  return promise;
}
