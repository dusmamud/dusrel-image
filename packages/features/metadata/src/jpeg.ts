import { exifFromTiff, parseTiff, serializeTiffWithoutGps } from "./tiff.js";
import type { MetadataInfo, StripOptions } from "./types.js";

export const isJpeg = (b: Uint8Array) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8;

interface Segment {
  marker: number;
  /** Byte offset of the 0xFF marker prefix. */
  start: number;
  /** Total segment length including marker and length field (scan data excluded). */
  length: number;
  /** Payload after the length field (for length-bearing segments). */
  payloadStart: number;
  payloadLength: number;
}

function walkSegments(bytes: Uint8Array): { segments: Segment[]; scanStart: number } {
  const segments: Segment[] = [];
  let at = 2; // past SOI
  while (at + 1 < bytes.length) {
    if (bytes[at] !== 0xff) break;
    let marker = bytes[at + 1]!;
    // Skip fill 0xFF bytes.
    while (marker === 0xff && at + 2 < bytes.length) {
      at++;
      marker = bytes[at + 1]!;
    }
    if (marker === 0x00 || marker === 0xd9) break; // stuffed byte or EOI
    if (marker === 0xda) {
      // SOS: length field, then entropy-coded data until EOI.
      const len = (bytes[at + 2]! << 8) | bytes[at + 3]!;
      segments.push({
        marker,
        start: at,
        length: 2 + len,
        payloadStart: at + 4,
        payloadLength: len - 2,
      });
      return { segments, scanStart: at + 2 + len };
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      segments.push({ marker, start: at, length: 2, payloadStart: at + 2, payloadLength: 0 });
      at += 2;
      continue;
    }
    const len = (bytes[at + 2]! << 8) | bytes[at + 3]!;
    segments.push({
      marker,
      start: at,
      length: 2 + len,
      payloadStart: at + 4,
      payloadLength: len - 2,
    });
    at += 2 + len;
  }
  return { segments, scanStart: bytes.length };
}

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const XMP_HEADER = "http://ns.adobe.com/xap/1.0/\0";

function hasPrefix(bytes: Uint8Array, start: number, prefix: readonly number[]): boolean {
  return prefix.every((v, i) => bytes[start + i] === v);
}
function hasAsciiPrefix(bytes: Uint8Array, start: number, text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (bytes[start + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

export function readJpegMetadata(bytes: Uint8Array): MetadataInfo {
  const { segments } = walkSegments(bytes);
  const info: MetadataInfo = {
    format: "jpeg",
    exifPresent: false,
    xmpPresent: false,
    iccPresent: false,
  };
  for (const seg of segments) {
    if (seg.marker === 0xe1 && hasPrefix(bytes, seg.payloadStart, EXIF_HEADER)) {
      info.exifPresent = true;
      const tiff = parseTiff(bytes, seg.payloadStart + EXIF_HEADER.length);
      if (tiff) info.exif = exifFromTiff(tiff);
    } else if (seg.marker === 0xe1 && hasAsciiPrefix(bytes, seg.payloadStart, XMP_HEADER)) {
      info.xmpPresent = true;
    } else if (seg.marker === 0xe2 && hasAsciiPrefix(bytes, seg.payloadStart, "ICC_PROFILE\0")) {
      info.iccPresent = true;
    }
  }
  return info;
}

export function stripJpegMetadata(bytes: Uint8Array, options: Required<StripOptions>): Uint8Array {
  const { segments, scanStart } = walkSegments(bytes);
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  for (const seg of segments) {
    const slice = bytes.subarray(seg.start, seg.start + seg.length);
    if (seg.marker === 0xda) {
      parts.push(slice);
      break;
    }
    if (options.mode === "all") {
      if (seg.marker === 0xfe) continue; // COM
      if (seg.marker >= 0xe1 && seg.marker <= 0xef) {
        if (
          seg.marker === 0xe2 &&
          options.keepIcc &&
          hasAsciiPrefix(bytes, seg.payloadStart, "ICC_PROFILE\0")
        ) {
          parts.push(slice);
        }
        continue; // APP1..APP15 dropped
      }
      parts.push(slice);
      continue;
    }
    // gps-only: rebuild the EXIF APP1 without GPS; keep everything else.
    if (seg.marker === 0xe1 && hasPrefix(bytes, seg.payloadStart, EXIF_HEADER)) {
      const tiff = parseTiff(bytes, seg.payloadStart + EXIF_HEADER.length);
      if (tiff && tiff.gps) {
        const rebuilt = serializeTiffWithoutGps(tiff);
        const payloadLength = EXIF_HEADER.length + rebuilt.length;
        const segOut = new Uint8Array(4 + payloadLength);
        segOut[0] = 0xff;
        segOut[1] = 0xe1;
        segOut[2] = (payloadLength + 2) >> 8;
        segOut[3] = (payloadLength + 2) & 0xff;
        segOut.set(EXIF_HEADER, 4);
        segOut.set(rebuilt, 4 + EXIF_HEADER.length);
        parts.push(segOut);
        continue;
      }
    }
    parts.push(slice);
  }
  parts.push(bytes.subarray(scanStart));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
