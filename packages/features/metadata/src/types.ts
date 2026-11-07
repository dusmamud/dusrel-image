export type ImageFormat = "jpeg" | "png" | "webp";

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
}

export interface ExifData {
  make?: string;
  model?: string;
  orientation?: number;
  software?: string;
  /** Raw EXIF DateTime string ("YYYY:MM:DD HH:mm:ss"), unparsed on purpose. */
  dateTime?: string;
  /** Raw EXIF DateTimeOriginal string. */
  dateTimeOriginal?: string;
  gps?: GpsCoordinates;
}

export interface MetadataInfo {
  format: ImageFormat | null;
  exifPresent: boolean;
  xmpPresent: boolean;
  iccPresent: boolean;
  /** PNG textual chunk keys (tEXt/iTXt/zTXt), when the format is PNG. */
  textKeys?: string[];
  exif?: ExifData;
}

export interface StripOptions {
  /**
   * 'all' removes every metadata carrier (EXIF, XMP, textual
   * chunks, comments; ICC too unless keepIcc). 'gps-only' rebuilds
   * the EXIF block without the GPS IFD — every other tag survives,
   * but a JPEG thumbnail IFD is dropped by the rebuild (documented
   * trade-off).
   */
  mode?: "all" | "gps-only";
  /** With mode 'all': keep the ICC colour profile (default false). */
  keepIcc?: boolean;
}
