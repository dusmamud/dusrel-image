/**
 * Target-size quality search.
 *
 * Binary search over quality: find the highest quality whose encoded size
 * is within budget, in a bounded number of encode attempts. Kept separate
 * from the canvas code (the encoder is injected) so it is unit testable
 * with a stub encoder.
 */
import { DusrelImageError } from "./errors.js";

export interface QualitySearchResult<T> {
  value: T;
  quality: number;
  sizeBytes: number;
  /** False when even the minimum quality exceeded the budget (best effort). */
  met: boolean;
  attempts: number;
}

export interface QualitySearchOptions {
  maxQuality: number;
  minQuality?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
}

/**
 * `encodeAt(quality)` must resolve to the encoded value and its byte size.
 * Assumes encoded size grows monotonically with quality, which holds for
 * JPEG and WebP encoders in practice.
 */
export async function findQualityForTargetSize<T>(
  encodeAt: (quality: number) => Promise<{ value: T; sizeBytes: number }>,
  maxSizeBytes: number,
  options: QualitySearchOptions,
): Promise<QualitySearchResult<T>> {
  const minQuality = options.minQuality ?? 0.05;
  const maxAttempts = options.maxAttempts ?? 8;
  if (!Number.isFinite(maxSizeBytes) || maxSizeBytes < 1) {
    throw new DusrelImageError(
      "invalid-options",
      `maxSizeBytes must be a positive number, got ${maxSizeBytes}.`,
    );
  }

  let attempts = 0;
  const attempt = async (quality: number) => {
    if (options.signal?.aborted) {
      throw new DusrelImageError("aborted", "The operation was aborted.");
    }
    attempts += 1;
    return encodeAt(quality);
  };

  let lo = minQuality;
  let hi = options.maxQuality;
  let best: QualitySearchResult<T> | undefined;

  const first = await attempt(hi);
  if (first.sizeBytes <= maxSizeBytes) {
    return { value: first.value, quality: hi, sizeBytes: first.sizeBytes, met: true, attempts };
  }
  best = { value: first.value, quality: hi, sizeBytes: first.sizeBytes, met: false, attempts };

  while (attempts < maxAttempts) {
    const mid = (lo + hi) / 2;
    if (hi - lo < 0.01) break;
    const result = await attempt(mid);
    if (result.sizeBytes <= maxSizeBytes) {
      best = {
        value: result.value,
        quality: mid,
        sizeBytes: result.sizeBytes,
        met: true,
        attempts,
      };
      lo = mid;
    } else {
      if (!best.met && result.sizeBytes < best.sizeBytes) {
        best = {
          value: result.value,
          quality: mid,
          sizeBytes: result.sizeBytes,
          met: false,
          attempts,
        };
      }
      hi = mid;
    }
  }

  // Guaranteed final probe at the quality floor: when the budget is
  // impossible this yields the true smallest output, so total attempts
  // can reach maxAttempts + 1 in that case only.
  if (!best.met) {
    const floor = await attempt(minQuality);
    if (floor.sizeBytes <= maxSizeBytes) {
      return {
        value: floor.value,
        quality: minQuality,
        sizeBytes: floor.sizeBytes,
        met: true,
        attempts,
      };
    }
    if (floor.sizeBytes < best.sizeBytes) {
      best = {
        value: floor.value,
        quality: minQuality,
        sizeBytes: floor.sizeBytes,
        met: false,
        attempts,
      };
    }
  }

  return { ...best, attempts };
}
