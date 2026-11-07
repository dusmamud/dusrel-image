import { exifFromTiff, parseTiff, serializeTiffWithoutGps } from "./tiff.js";
import type { MetadataInfo, StripOptions } from "./types.js";

export const isWebp = (b: Uint8Array) =>
  b.length > 12 &&
  b[0] === 0x52 &&
  b[1] === 0x49 &&
  b[2] === 0x46 &&
  b[3] === 0x46 &&
  b[8] === 0x57 &&
  b[9] === 0x45 &&
  b[10] === 0x42 &&
  b[11] === 0x50;

interface Chunk {
  type: string;
  start: number; // at the fourcc
  dataStart: number;
  dataLength: number;
  totalLength: number; // 8 + dataLength + pad
}

function walkChunks(bytes: Uint8Array): Chunk[] {
  const chunks: Chunk[] = [];
  let at = 12;
  while (at + 8 <= bytes.length) {
    const type = String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
    const length = new DataView(bytes.buffer, bytes.byteOffset + at + 4, 4).getUint32(0, true);
    chunks.push({
      type,
      start: at,
      dataStart: at + 8,
      dataLength: length,
      totalLength: 8 + length + (length % 2),
    });
    at += 8 + length + (length % 2);
  }
  return chunks;
}

const VP8X_ICC = 0x20;
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

export function readWebpMetadata(bytes: Uint8Array): MetadataInfo {
  const chunks = walkChunks(bytes);
  const info: MetadataInfo = {
    format: "webp",
    exifPresent: false,
    xmpPresent: false,
    iccPresent: false,
  };
  for (const chunk of chunks) {
    if (chunk.type === "EXIF") {
      info.exifPresent = true;
      const tiff = parseTiff(
        bytes.subarray(chunk.dataStart, chunk.dataStart + chunk.dataLength),
        0,
      );
      if (tiff) info.exif = exifFromTiff(tiff);
    } else if (chunk.type === "XMP ") {
      info.xmpPresent = true;
    } else if (chunk.type === "ICCP") {
      info.iccPresent = true;
    }
  }
  return info;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + data.length + (data.length % 2));
  for (let i = 0; i < 4; i++) out[i] = type.charCodeAt(i);
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}

export function stripWebpMetadata(bytes: Uint8Array, options: Required<StripOptions>): Uint8Array {
  const chunks = walkChunks(bytes);
  const parts: Uint8Array[] = [bytes.subarray(0, 12)];
  let stripMask = 0;
  for (const chunk of chunks) {
    const slice = bytes.subarray(chunk.start, chunk.start + chunk.totalLength);
    if (options.mode === "all") {
      if (chunk.type === "EXIF") {
        stripMask |= VP8X_EXIF;
        continue;
      }
      if (chunk.type === "XMP ") {
        stripMask |= VP8X_XMP;
        continue;
      }
      if (chunk.type === "ICCP" && !options.keepIcc) {
        stripMask |= VP8X_ICC;
        continue;
      }
      parts.push(slice);
      continue;
    }
    if (chunk.type === "EXIF") {
      const tiff = parseTiff(
        bytes.subarray(chunk.dataStart, chunk.dataStart + chunk.dataLength),
        0,
      );
      if (tiff && tiff.gps) {
        parts.push(makeChunk("EXIF", serializeTiffWithoutGps(tiff)));
        continue;
      }
    }
    parts.push(slice);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  // Rewrite the RIFF size and clear VP8X feature bits for removed chunks,
  // otherwise decoders hunt for chunks that no longer exist.
  new DataView(out.buffer).setUint32(4, total - 8, true);
  if (stripMask !== 0) {
    // VP8X is the first chunk when present.
    if (out[12] === 0x56 && out[13] === 0x50 && out[14] === 0x38 && out[15] === 0x58) {
      out[20] = out[20]! & ~stripMask;
    }
  }
  return out;
}
