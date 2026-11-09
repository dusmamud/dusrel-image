/**
 * Lazy Emscripten module loading. Nothing is fetched or
 * instantiated until the first WASM decode (or an explicit
 * init), so merely importing this package — or decoding on a
 * browser with native HEIC support — costs no network and no
 * WASM compile.
 *
 * The user-replaceable asset URLs double as the LGPL
 * relink/replace mechanism for the engine files (ADR-0008).
 */
import type { CodecAssets } from "./types.js";

export interface EmscriptenCodecModule {
  cwrap: (name: string, returnType: string, argTypes: string[]) => (...args: number[]) => number;
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  _dusrel_heic_last_step: () => number;
}

type ModuleFactory = (options: {
  locateFile?: (path: string, prefix: string) => string;
}) => Promise<EmscriptenCodecModule>;

let assets: CodecAssets = {};
let cached: Promise<EmscriptenCodecModule> | undefined;

/** Overrides where the codec assets are loaded from. May be called at any time; the codec reloads from the new URLs on next use. */
export function setCodecAssets(next: CodecAssets): void {
  assets = { ...assets, ...next };
  cached = undefined;
}

function defaultAssetUrl(ext: "js" | "wasm"): string {
  return new URL(`../codec/heic_dec.${ext}`, import.meta.url).href;
}

export function loadModule(): Promise<EmscriptenCodecModule> {
  if (cached) return cached;
  cached = (async () => {
    const jsUrl = assets.jsUrl ?? defaultAssetUrl("js");
    const wasmUrl = assets.wasmUrl ?? defaultAssetUrl("wasm");
    const factory = ((await import(/* @vite-ignore */ jsUrl)) as { default: ModuleFactory })
      .default;
    return factory({
      locateFile: (path) => (path.endsWith(".wasm") ? wasmUrl : path),
    });
  })();
  return cached;
}
