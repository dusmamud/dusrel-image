/**
 * @dusrel/image-metadata
 *
 * Byte-level metadata work for JPEG, PNG and WebP — no decoding,
 * no dependencies, identical results in Node, workers and
 * browsers. Read the common EXIF fields (including GPS), strip
 * everything, or strip only the GPS block while keeping the rest
 * of the EXIF intact.
 *
 * Note the pipeline context: any Canvas/WASM re-encode already
 * drops metadata (pixels carry none). This package is for working
 * on the original file bytes — inspection, privacy scrubbing
 * without a re-encode, and preserve-on-request flows.
 */
import { isJpeg, readJpegMetadata, stripJpegMetadata } from "./jpeg.js";
import { isPng, readPngMetadata, stripPngMetadata } from "./png.js";
import { isWebp, readWebpMetadata, stripWebpMetadata } from "./webp.js";
import type { MetadataInfo, StripOptions } from "./types.js";

export type { ExifData, GpsCoordinates, ImageFormat, MetadataInfo, StripOptions } from "./types.js";

export function detectFormat(bytes: Uint8Array): MetadataInfo["format"] {
  if (isJpeg(bytes)) return "jpeg";
  if (isPng(bytes)) return "png";
  if (isWebp(bytes)) return "webp";
  return null;
}

/** Reads metadata presence + parsed EXIF fields. Never throws on malformed files — worst case, fields are absent. */
export function readMetadata(bytes: Uint8Array): MetadataInfo {
  const format = detectFormat(bytes);
  if (format === "jpeg") return readJpegMetadata(bytes);
  if (format === "png") return readPngMetadata(bytes);
  if (format === "webp") return readWebpMetadata(bytes);
  return { format: null, exifPresent: false, xmpPresent: false, iccPresent: false };
}

/** Convenience: does this file carry GPS coordinates? */
export function hasGps(bytes: Uint8Array): boolean {
  return readMetadata(bytes).exif?.gps !== undefined;
}

/**
 * Returns a new byte array with metadata removed per options
 * (default: strip everything). Image data is copied byte-for-byte
 * — pixels are never touched, so there is zero quality loss.
 * Unknown formats are returned as a copy, unchanged.
 */
export function stripMetadata(bytes: Uint8Array, options: StripOptions = {}): Uint8Array {
  const resolved: Required<StripOptions> = {
    mode: options.mode ?? "all",
    keepIcc: options.keepIcc ?? false,
  };
  if (resolved.mode !== "all" && resolved.mode !== "gps-only") {
    throw new RangeError(`mode must be 'all' or 'gps-only', got ${String(resolved.mode)}.`);
  }
  const format = detectFormat(bytes);
  if (format === "jpeg") return stripJpegMetadata(bytes, resolved);
  if (format === "png") return stripPngMetadata(bytes, resolved);
  if (format === "webp") return stripWebpMetadata(bytes, resolved);
  return bytes.slice();
}
