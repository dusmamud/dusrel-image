/**
 * Easy mode: one call, sensible defaults, a full report — implemented
 * directly on the core engine (one code path, docs/API_DESIGN.md
 * section 2).
 */
import {
  decodeImage,
  DusrelImageError,
  processImage as coreProcessImage,
  type ImageInput,
  type ProcessOptions,
  type ProcessResult,
} from "@dusrel/image-core";
import { downgradeChain } from "./fallback.js";
import { buildReport } from "./report.js";
import type { ImageOptions, ImageResult } from "./types.js";

function splitOptions(options: ImageOptions): {
  core: ProcessOptions;
  fallback: ImageOptions["fallback"];
  timeoutMs?: number;
} {
  const { fallback = "throw", timeoutMs, plugins: _plugins, ...core } = options;
  const out: { core: ProcessOptions; fallback: ImageOptions["fallback"]; timeoutMs?: number } = {
    core,
    fallback,
  };
  if (timeoutMs !== undefined) out.timeoutMs = timeoutMs;
  return out;
}

/** Combines the caller's signal with an optional timeout into one signal. */
function withTimeout(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): { signal?: AbortSignal; cleanup: () => void } {
  if (timeoutMs === undefined) {
    return { ...(signal ? { signal } : {}), cleanup: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Processing timed out after ${timeoutMs} ms.`)),
    timeoutMs,
  );
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

function toImageResult(result: ProcessResult, started: number, fallbacks: string[]): ImageResult {
  return { ...result, report: buildReport(result, performance.now() - started, fallbacks) };
}

async function originalAsResult(
  input: ImageInput,
  fallbacks: string[],
  started: number,
): Promise<ImageResult | undefined> {
  let blob: Blob | undefined;
  if (input instanceof Blob) blob = input;
  else if (input instanceof ArrayBuffer) blob = new Blob([input]);
  else if (input instanceof Uint8Array) blob = new Blob([input as BlobPart]);
  if (!blob) return undefined;
  // Format reports the original Blob's real type when it is one of ours;
  // width/height come from a best-effort decode (0 when even that fails,
  // e.g. the input itself was undecodable — the blob is still returned
  // untouched, which is the entire point of this policy).
  const format =
    (["image/jpeg", "image/png", "image/webp"] as const).find((f) => f === blob.type) ??
    "image/png";
  let width = 0;
  let height = 0;
  try {
    const decoded = await decodeImage(blob);
    width = decoded.width;
    height = decoded.height;
    if (decoded.owned && decoded.source instanceof ImageBitmap) decoded.source.close();
  } catch {
    // Dimensions stay unknown; the original is still returned as promised.
  }
  const result: ProcessResult = {
    blob,
    format,
    width,
    height,
    sizeBytes: blob.size,
    originalSizeBytes: blob.size,
    qualityUsed: 1,
    steps: [],
  };
  const imageResult = toImageResult(result, started, fallbacks);
  imageResult.report.stepsApplied = ["fallback:return-original"];
  return imageResult;
}

/**
 * Processes one image with the main package: core engine + defaults +
 * fallback policy + report.
 *
 * @example
 * const { blob, report } = await processImage(file, { maxSizeBytes: 200_000 });
 */
export async function processImage(
  input: ImageInput,
  options: ImageOptions = {},
): Promise<ImageResult> {
  const started = performance.now();
  const { core, fallback, timeoutMs } = splitOptions(options);
  const fallbacks: string[] = [];
  const timed = withTimeout(core.signal, timeoutMs);
  const effective: ProcessOptions = { ...core };
  if (timed.signal) effective.signal = timed.signal;
  else delete effective.signal;

  try {
    const result = await coreProcessImage(input, effective);
    return toImageResult(result, started, fallbacks);
  } catch (cause) {
    if (fallback === "return-original") {
      const original = await originalAsResult(input, [...fallbacks, "return-original"], started);
      if (original) return original;
      throw cause;
    }
    if (
      fallback === "downgrade-format" &&
      cause instanceof DusrelImageError &&
      cause.code === "unsupported-format" &&
      effective.format
    ) {
      let lastError: unknown = cause;
      let from = effective.format;
      for (const next of downgradeChain(effective.format)) {
        fallbacks.push(`downgrade-format:${from}->${next}`);
        try {
          const result = await coreProcessImage(input, { ...effective, format: next });
          return toImageResult(result, started, fallbacks);
        } catch (retryCause) {
          lastError = retryCause;
          from = next;
          if (!(retryCause instanceof DusrelImageError && retryCause.code === "unsupported-format"))
            break;
        }
      }
      throw lastError;
    }
    throw cause;
  } finally {
    timed.cleanup();
  }
}
