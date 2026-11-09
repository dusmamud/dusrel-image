import { loadModule, setCodecAssets, type EmscriptenCodecModule } from "./module.js";
import type { CodecAssets, HeicDecodeOptions } from "./types.js";

/** Brands that mean the media inside is HEVC-coded. */
const HEVC_BRANDS = new Set(["heic", "heix", "heis", "hevc", "hevx", "hevm", "hevs", "heim"]);

/** Generic HEIF container brands (codec decided by the media). */
const HEIF_BRANDS = new Set(["mif1", "mif2", "msf1"]);

/**
 * Sniffs the ISO-BMFF `ftyp` box. Never trust a file extension
 * or MIME type for this — Windows often reports an empty type
 * for real HEIC files (ADR-0008).
 *
 * Rules: an AVIF brand anywhere disqualifies the file (AVIF is
 * a different codec, @dusrel/image-avif — and AVIF files often
 * list the generic `mif1` brand as compatible, so that brand
 * alone proves nothing). Otherwise a HEVC brand as major or
 * compatible brand, or a generic HEIF major brand, counts;
 * libheif still reports a precise error if a generic-brand
 * file's media turns out not to be HEVC.
 */
export function isHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) {
    return false; // not "ftyp"
  }
  const boxSize =
    ((bytes[0] as number) << 24) |
    ((bytes[1] as number) << 16) |
    ((bytes[2] as number) << 8) |
    (bytes[3] as number);
  const end = Math.min(boxSize >= 16 ? boxSize : bytes.length, bytes.length);
  const brands: string[] = [];
  for (let offset = 8; offset + 4 <= end; offset += 4) {
    if (offset === 12) continue; // minor version, not a brand
    brands.push(
      String.fromCharCode(
        bytes[offset] as number,
        bytes[offset + 1] as number,
        bytes[offset + 2] as number,
        bytes[offset + 3] as number,
      ),
    );
  }
  if (brands.some((b) => b === "avif" || b === "avis")) return false;
  const major = brands[0] as string;
  if (HEVC_BRANDS.has(major) || HEIF_BRANDS.has(major)) return true;
  return brands.some((b) => HEVC_BRANDS.has(b));
}

type DecodeFn = (data: number, size: number, outWidth: number, outHeight: number) => number;

let boundDecode: { mod: EmscriptenCodecModule; fn: DecodeFn } | undefined;

async function getDecodeFn(): Promise<{ mod: EmscriptenCodecModule; fn: DecodeFn }> {
  const mod = await loadModule();
  // The cwrap'd function belongs to one module instance. setCodecAssets
  // clears the module cache, so a later load can return a different
  // instance — rebind whenever the instance changes, otherwise the old
  // instance's function would be called with the new module's pointers
  // (which silently produced empty output before this fix).
  if (!boundDecode || boundDecode.mod !== mod) {
    boundDecode = {
      mod,
      fn: mod.cwrap("dusrel_heic_decode", "number", [
        "number",
        "number",
        "number",
        "number",
      ]) as DecodeFn,
    };
  }
  return boundDecode;
}

/** Loads and instantiates the decoder WASM ahead of first use. */
export async function init(assetOverrides?: CodecAssets): Promise<void> {
  if (assetOverrides) setCodecAssets(assetOverrides);
  await loadModule();
}

const STEP_NAMES: Record<number, string> = {
  1: "context allocation",
  2: "reading the input",
  3: "locating the primary image",
  4: "HEVC decoding",
  5: "reading the decoded pixels",
  6: "allocating the output",
};

/**
 * Decodes HEIC bytes with the bundled libheif WASM, always —
 * the deterministic path, identical in every browser.
 */
export async function decodeHeicWasm(bytes: Uint8Array): Promise<ImageData> {
  if (bytes.length === 0) throw new RangeError("Cannot decode an empty byte buffer.");
  const { mod, fn } = await getDecodeFn();
  const inPtr = mod._malloc(bytes.length);
  const widthPtr = mod._malloc(4);
  const heightPtr = mod._malloc(4);
  try {
    mod.HEAPU8.set(bytes, inPtr);
    const outPtr = fn(inPtr, bytes.length, widthPtr, heightPtr);
    if (outPtr === 0) {
      const step = mod._dusrel_heic_last_step();
      const where = STEP_NAMES[step] ?? `step ${step}`;
      throw new Error(`libheif decode failed at ${where} (the input is not a decodable HEIC).`);
    }
    try {
      const width = mod.HEAPU32[widthPtr >> 2] as number;
      const height = mod.HEAPU32[heightPtr >> 2] as number;
      const pixels = mod.HEAPU8.slice(outPtr, outPtr + width * height * 4);
      return new ImageData(new Uint8ClampedArray(pixels), width, height);
    } finally {
      mod._free(outPtr);
    }
  } finally {
    mod._free(inPtr);
    mod._free(widthPtr);
    mod._free(heightPtr);
  }
}

/**
 * The native path: on Safari 17+ `createImageBitmap` decodes
 * HEIC directly (orientation honoured, grid tiles stitched) —
 * the attempt is the probe, so nothing is decoded twice and no
 * WASM is fetched where this succeeds. Returns null on any
 * failure so the caller falls back to WASM.
 */
async function tryNativeDecode(bytes: Uint8Array): Promise<ImageData | null> {
  if (typeof createImageBitmap !== "function") return null;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
    const { width, height } = bitmap;
    if (width <= 0 || height <= 0) return null;
    if (typeof OffscreenCanvas === "function") {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, width, height);
    }
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, width, height);
    }
    return null;
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

/**
 * Decodes a HEIC/HEIF file to raw RGBA pixels (an ImageData).
 * Native-first by default (ADR-0008): Safari decodes without
 * downloading the WASM at all; every other browser uses the
 * bundled libheif build. Throws a RangeError when the input is
 * not a HEIC file at all.
 */
export async function decodeHeic(
  input: Uint8Array | ArrayBuffer | Blob,
  options: HeicDecodeOptions = {},
): Promise<ImageData> {
  const bytes =
    input instanceof Uint8Array
      ? input
      : input instanceof Blob
        ? new Uint8Array(await input.arrayBuffer())
        : new Uint8Array(input);
  if (!isHeic(bytes)) {
    throw new RangeError("Not a HEIC/HEIF file (no HEIC brand in the ftyp box).");
  }
  if (options.nativeFirst !== false) {
    const native = await tryNativeDecode(bytes);
    if (native) return native;
  }
  return decodeHeicWasm(bytes);
}
