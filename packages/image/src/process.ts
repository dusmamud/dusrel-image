/**
 * Easy mode: one call, sensible defaults, a full report — implemented
 * directly on the core engine (one code path, docs/API_DESIGN.md
 * section 2).
 */
import {
  decodeImage,
  DusrelImageError,
  OUTPUT_FORMATS,
  processImage as coreProcessImage,
  type ImageInput,
  type OutputFormat,
  type ProcessOptions,
  type ProcessResult,
} from "@dusrel/image-core";
import { resolveCodecPluginName } from "./codec-plugin.js";
import { downgradeChain } from "./fallback.js";
import { encodeViaCodec, findCodec, runPluginSteps } from "./plugins.js";
import { buildReport } from "./report.js";
import type { CodecPluginDefinition, ImageOptions, ImagePlugin, ImageResult } from "./types.js";

interface SplitOptions {
  core: ProcessOptions;
  fallback: ImageOptions["fallback"];
  timeoutMs?: number;
  plugins?: ImagePlugin[];
  codecDef?: CodecPluginDefinition;
}

/**
 * Splits wrapper options from core options and resolves a
 * non-canvas `format` against the registered codecs
 * (docs/API_DESIGN.md section 6). An unregistered non-canvas
 * format is a programming error: it throws the typed
 * `unsupported-format` error here, before any processing -
 * never a silent fallback to a canvas format.
 */
function splitOptions(options: ImageOptions): SplitOptions {
  const { fallback = "throw", timeoutMs, plugins, codecs, format, ...rest } = options;
  const core: ProcessOptions = { ...rest };
  let codecDef: CodecPluginDefinition | undefined;
  if (format !== undefined) {
    if ((OUTPUT_FORMATS as readonly string[]).includes(format)) {
      core.format = format as OutputFormat;
    } else {
      codecDef = findCodec(codecs, format);
      if (!codecDef) {
        throw new DusrelImageError(
          "unsupported-format",
          `Format "${format}" is not a canvas format and no codec is registered for it. ` +
            "Pass the codec package's definition in options.codecs.",
        );
      }
      // The core pass runs losslessly; the codec encodes after.
      core.format = "image/png";
    }
  }
  const out: SplitOptions = { core, fallback };
  if (timeoutMs !== undefined) out.timeoutMs = timeoutMs;
  if (plugins !== undefined) out.plugins = plugins;
  if (codecDef !== undefined) out.codecDef = codecDef;
  return out;
}

/**
 * The post-core stages of easy mode: registered plugin steps in
 * order, then the registered codec encode when `format` named
 * one. Report steps record both (`plugin:<name>`, `codec:<fmt>`).
 */
async function applyPluginsAndCodec(
  result: ProcessResult,
  split: SplitOptions,
  signal: AbortSignal | undefined,
  started: number,
  fallbacks: string[],
): Promise<ImageResult> {
  let current: ProcessResult = result;
  const context = { previous: current, ...(signal ? { signal } : {}) };
  if (split.plugins && split.plugins.length > 0) {
    const stepped = await runPluginSteps(current.blob, split.plugins, context);
    current = {
      ...current,
      blob: stepped.blob,
      sizeBytes: stepped.blob.size,
      steps: [...current.steps, ...stepped.steps],
    };
  }
  if (split.codecDef) {
    const encoded = await encodeViaCodec(current.blob, split.codecDef, context);
    const withCodec: ProcessResult = {
      ...current,
      blob: encoded,
      sizeBytes: encoded.size,
      steps: [...current.steps, resolveCodecPluginName(split.codecDef)],
    };
    const report = buildReport(withCodec, performance.now() - started, fallbacks);
    report.format = split.codecDef.mimeType;
    return { ...withCodec, format: split.codecDef.mimeType, report };
  }
  return toImageResult(current, started, fallbacks);
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
  const split = splitOptions(options);
  const { core, fallback, timeoutMs } = split;
  const fallbacks: string[] = [];
  const timed = withTimeout(core.signal, timeoutMs);
  const effective: ProcessOptions = { ...core };
  if (timed.signal) effective.signal = timed.signal;
  else delete effective.signal;

  try {
    const result = await coreProcessImage(input, effective);
    return await applyPluginsAndCodec(result, split, effective.signal, started, fallbacks);
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
