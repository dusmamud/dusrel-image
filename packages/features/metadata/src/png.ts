import { exifFromTiff, parseTiff, serializeTiffWithoutGps } from "./tiff.js";
import type { MetadataInfo, StripOptions } from "./types.js";

export const isPng = (b: Uint8Array) =>
  b.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v);

// CRC32 (PNG polynomial) — needed when a chunk is rewritten (eXIf gps-only).
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();
export function crc32(bytes: Uint8Array, start: number, length: number): number {
  let c = 0xffffffff;
  for (let i = start; i < start + length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface Chunk {
  type: string;
  start: number; // at the length field
  dataStart: number;
  dataLength: number;
  totalLength: number; // 12 + dataLength
}

function walkChunks(bytes: Uint8Array): Chunk[] {
  const chunks: Chunk[] = [];
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0, false);
    const type = String.fromCharCode(
      bytes[at + 4]!,
      bytes[at + 5]!,
      bytes[at + 6]!,
      bytes[at + 7]!,
    );
    chunks.push({
      type,
      start: at,
      dataStart: at + 8,
      dataLength: length,
      totalLength: 12 + length,
    });
    at += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

const TEXT_TYPES = new Set(["tEXt", "iTXt", "zTXt"]);

export function readPngMetadata(bytes: Uint8Array): MetadataInfo {
  const chunks = walkChunks(bytes);
  const info: MetadataInfo = {
    format: "png",
    exifPresent: false,
    xmpPresent: false,
    iccPresent: false,
    textKeys: [],
  };
  for (const chunk of chunks) {
    if (chunk.type === "eXIf") {
      info.exifPresent = true;
      const tiff = parseTiff(
        bytes.subarray(chunk.dataStart, chunk.dataStart + chunk.dataLength),
        0,
      );
      if (tiff) info.exif = exifFromTiff(tiff);
    } else if (chunk.type === "iCCP") {
      info.iccPresent = true;
    } else if (TEXT_TYPES.has(chunk.type)) {
      const end = bytes.indexOf(0, chunk.dataStart);
      const key = new TextDecoder().decode(
        bytes.subarray(chunk.dataStart, end === -1 ? chunk.dataStart + chunk.dataLength : end),
      );
      info.textKeys!.push(key);
      if (key === "XML:com.adobe.xmp") info.xmpPresent = true;
    }
  }
  return info;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length, false);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out, 4, 4 + data.length), false);
  return out;
}

export function stripPngMetadata(bytes: Uint8Array, options: Required<StripOptions>): Uint8Array {
  const chunks = walkChunks(bytes);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  for (const chunk of chunks) {
    const slice = bytes.subarray(chunk.start, chunk.start + chunk.totalLength);
    if (options.mode === "all") {
      if (chunk.type === "eXIf" || TEXT_TYPES.has(chunk.type) || chunk.type === "tIME") continue;
      if (chunk.type === "iCCP" && !options.keepIcc) continue;
      parts.push(slice);
      continue;
    }
    // gps-only: rebuild eXIf without GPS.
    if (chunk.type === "eXIf") {
      const tiff = parseTiff(
        bytes.subarray(chunk.dataStart, chunk.dataStart + chunk.dataLength),
        0,
      );
      if (tiff && tiff.gps) {
        parts.push(makeChunk("eXIf", serializeTiffWithoutGps(tiff)));
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
  return out;
}
