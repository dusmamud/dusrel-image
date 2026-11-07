import type { ExifData, GpsCoordinates } from "./types.js";

// Minimal, careful TIFF/EXIF reader + re-writer. EXIF data in
// JPEG APP1, PNG eXIf and WebP EXIF is the same TIFF structure.

const TYPE_SIZES: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
  13: 4,
};

export interface TiffEntry {
  tag: number;
  type: number;
  count: number;
  /** The entry's value bytes (exactly count * typeSize), copied out. */
  value: Uint8Array;
}

export interface TiffItd {
  ifd0: TiffEntry[];
  exif?: TiffEntry[];
  gps?: TiffEntry[];
  littleEndian: boolean;
}

class Reader {
  constructor(
    private readonly view: DataView,
    private readonly littleEndian: boolean,
  ) {}
  u16(offset: number): number {
    return this.view.getUint16(offset, this.littleEndian);
  }
  u32(offset: number): number {
    return this.view.getUint32(offset, this.littleEndian);
  }
  i32(offset: number): number {
    return this.view.getInt32(offset, this.littleEndian);
  }
}

function parseItd(
  view: DataView,
  r: Reader,
  tiffStart: number,
  offset: number,
): TiffEntry[] | undefined {
  if (offset === 0 || tiffStart + offset + 2 > view.byteLength) return undefined;
  const count = r.u16(tiffStart + offset);
  const entries: TiffEntry[] = [];
  for (let i = 0; i < count; i++) {
    const at = tiffStart + offset + 2 + i * 12;
    if (at + 12 > view.byteLength) break;
    const tag = r.u16(at);
    const type = r.u16(at + 2);
    const cnt = r.u32(at + 4);
    const size = (TYPE_SIZES[type] ?? 1) * cnt;
    let value: Uint8Array;
    if (size <= 4) {
      value = new Uint8Array(view.buffer, view.byteOffset + at + 8, size).slice();
    } else {
      const valueOffset = r.u32(at + 8);
      if (tiffStart + valueOffset + size > view.byteLength) continue;
      value = new Uint8Array(view.buffer, view.byteOffset + tiffStart + valueOffset, size).slice();
    }
    entries.push({ tag, type, count: cnt, value });
  }
  return entries;
}

export function parseTiff(bytes: Uint8Array, start: number): TiffItd | undefined {
  if (start + 8 > bytes.length) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const orderMark = view.getUint16(start, false);
  let littleEndian: boolean;
  if (orderMark === 0x4949) littleEndian = true;
  else if (orderMark === 0x4d4d) littleEndian = false;
  else return undefined;
  const r = new Reader(view, littleEndian);
  if (r.u16(start + 2) !== 42) return undefined;
  const ifd0Offset = r.u32(start + 4);
  const ifd0 = parseItd(view, r, start, ifd0Offset);
  if (!ifd0) return undefined;

  const findOffset = (entries: TiffEntry[], tag: number): number | undefined => {
    const e = entries.find((x) => x.tag === tag);
    if (!e || e.value.length < 4) return undefined;
    const dv = new DataView(e.value.buffer, e.value.byteOffset, e.value.byteLength);
    return e.type === 4
      ? dv.getUint32(0, littleEndian)
      : e.type === 3
        ? dv.getUint16(0, littleEndian)
        : undefined;
  };
  const exifOffset = findOffset(ifd0, 0x8769);
  const gpsOffset = findOffset(ifd0, 0x8825);
  const result: TiffItd = { ifd0, littleEndian };
  if (exifOffset) {
    const exif = parseItd(view, r, start, exifOffset);
    if (exif) result.exif = exif;
  }
  if (gpsOffset) {
    const gps = parseItd(view, r, start, gpsOffset);
    if (gps) result.gps = gps;
  }
  return result;
}

function ascii(entry: TiffEntry | undefined): string | undefined {
  if (!entry) return undefined;
  const text = new TextDecoder().decode(entry.value).replace(/\0+$/, "").trim();
  return text.length > 0 ? text : undefined;
}

function shortOrLong(bytes: Uint8Array, type: number, littleEndian: boolean): number | undefined {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === 3 && bytes.length >= 2) return dv.getUint16(0, littleEndian);
  if (type === 4 && bytes.length >= 4) return dv.getUint32(0, littleEndian);
  return undefined;
}

function rationalTriple(entry: TiffEntry | undefined, littleEndian: boolean): number | undefined {
  if (!entry || entry.count < 3 || entry.value.length < 24) return undefined;
  const dv = new DataView(entry.value.buffer, entry.value.byteOffset, entry.value.byteLength);
  const parts: number[] = [];
  for (let i = 0; i < 3; i++) {
    const num = dv.getUint32(i * 8, littleEndian);
    const den = dv.getUint32(i * 8 + 4, littleEndian);
    parts.push(den === 0 ? 0 : num / den);
  }
  return parts[0]! + parts[1]! / 60 + parts[2]! / 3600;
}

export function exifFromTiff(tiff: TiffItd): ExifData {
  const le = tiff.littleEndian;
  const find = (entries: TiffEntry[] | undefined, tag: number) =>
    entries?.find((e) => e.tag === tag);
  const data: ExifData = {};
  const make = ascii(find(tiff.ifd0, 0x010f));
  if (make) data.make = make;
  const model = ascii(find(tiff.ifd0, 0x0110));
  if (model) data.model = model;
  const orientationEntry = find(tiff.ifd0, 0x0112);
  if (orientationEntry) {
    const o = shortOrLong(orientationEntry.value, orientationEntry.type, le);
    if (o !== undefined) data.orientation = o;
  }
  const software = ascii(find(tiff.ifd0, 0x0131));
  if (software) data.software = software;
  const dateTime = ascii(find(tiff.ifd0, 0x0132));
  if (dateTime) data.dateTime = dateTime;
  const dto = ascii(find(tiff.exif, 0x9003));
  if (dto) data.dateTimeOriginal = dto;

  if (tiff.gps) {
    const lat = rationalTriple(find(tiff.gps, 2), le);
    const lon = rationalTriple(find(tiff.gps, 4), le);
    if (lat !== undefined && lon !== undefined) {
      const latRef = ascii(find(tiff.gps, 1));
      const lonRef = ascii(find(tiff.gps, 3));
      const gps: GpsCoordinates = {
        latitude: latRef === "S" ? -lat : lat,
        longitude: lonRef === "W" ? -lon : lon,
      };
      data.gps = gps;
    }
  }
  return data;
}

/**
 * Re-serialises a parsed TIFF without the GPS IFD (and without
 * IFD1/thumbnail chains — next-IFD is written as 0). All other
 * IFD0 and Exif-IFD entries are preserved byte-for-byte, with
 * offsets recomputed. Used by the 'gps-only' strip mode.
 */
export function serializeTiffWithoutGps(tiff: TiffItd): Uint8Array {
  const le = tiff.littleEndian;
  const ifd0 = tiff.ifd0.filter((e) => e.tag !== 0x8825 && e.tag !== 0x8769);
  const exif = tiff.exif;
  const hasExif = !!exif && exif.length > 0;

  // Layout: header(8) | IFD0 | IFD0 data | [ExifIFD | ExifIFD data]
  const ifd0Size = 2 + (ifd0.length + (hasExif ? 1 : 0)) * 12 + 4;
  const ifd0DataStart = 8 + ifd0Size;
  let ifd0DataSize = 0;
  for (const e of ifd0)
    if (e.value.length > 4) ifd0DataSize += e.value.length + (e.value.length % 2);
  const exifOffset = hasExif ? ifd0DataStart + ifd0DataSize : 0;
  const exifSize = hasExif ? 2 + exif!.length * 12 + 4 : 0;
  const exifDataStart = exifOffset + exifSize;
  let total = exifDataStart;
  if (hasExif) {
    for (const e of exif!) if (e.value.length > 4) total += e.value.length + (e.value.length % 2);
  } else {
    total = ifd0DataStart + ifd0DataSize;
  }

  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  // Header
  if (le) {
    out[0] = 0x49;
    out[1] = 0x49;
  } else {
    out[0] = 0x4d;
    out[1] = 0x4d;
  }
  dv.setUint16(2, 42, le);
  dv.setUint32(4, 8, le);

  const writeItd = (entries: TiffEntry[], at: number, dataStart: number): void => {
    const sorted = [...entries].sort((a, b) => a.tag - b.tag);
    dv.setUint16(at, sorted.length, le);
    let dataCursor = dataStart;
    sorted.forEach((e, i) => {
      const entryAt = at + 2 + i * 12;
      dv.setUint16(entryAt, e.tag, le);
      dv.setUint16(entryAt + 2, e.type, le);
      dv.setUint32(entryAt + 4, e.count, le);
      if (e.value.length <= 4) {
        out.set(e.value, entryAt + 8);
      } else {
        dv.setUint32(entryAt + 8, dataCursor, le);
        out.set(e.value, dataCursor);
        dataCursor += e.value.length + (e.value.length % 2);
      }
    });
    dv.setUint32(at + 2 + sorted.length * 12, 0, le); // next IFD: none
  };

  const ifd0All = hasExif
    ? [
        ...ifd0,
        {
          tag: 0x8769,
          type: 4,
          count: 1,
          value: (() => {
            const v = new Uint8Array(4);
            new DataView(v.buffer).setUint32(0, exifOffset, le);
            return v;
          })(),
        },
      ]
    : ifd0;
  writeItd(ifd0All, 8, ifd0DataStart);
  if (hasExif) writeItd(exif!, exifOffset, exifDataStart);
  return out;
}
