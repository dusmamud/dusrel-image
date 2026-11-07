/**
 * The Canvas pipeline: decode -> crop -> rotate/flip -> resize -> encode.
 *
 * This is the fast path of the whole family (docs/ARCHITECTURE.md section
 * 1): no WASM, no dependencies. WASM codec packages plug into the same
 * contract from the main @dusrel/image pipeline when a developer needs
 * AVIF or higher-quality encodes.
 */
import { decodeImage } from "./decode.js";
import { createCanvas, encodeCanvas, getContext2d } from "./encode.js";
import { DusrelImageError, throwIfAborted } from "./errors.js";
import { planTransform } from "./geometry.js";
import { findQualityForTargetSize } from "./target-size.js";
import {
  OUTPUT_FORMATS,
  type ImageInput,
  type OutputFormat,
  type ProcessOptions,
  type ProcessResult,
} from "./types.js";

function defaultFormat(input: ImageInput): OutputFormat {
  if (input instanceof Blob && (OUTPUT_FORMATS as readonly string[]).includes(input.type)) {
    return input.type as OutputFormat;
  }
  if (
    (typeof ImageData !== "undefined" && input instanceof ImageData) ||
    (typeof HTMLCanvasElement !== "undefined" && input instanceof HTMLCanvasElement) ||
    (typeof OffscreenCanvas !== "undefined" && input instanceof OffscreenCanvas)
  ) {
    return "image/png";
  }
  return "image/jpeg";
}

function validateQuality(quality: number): number {
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
    throw new DusrelImageError(
      "invalid-options",
      `quality must be between 0 and 1, got ${quality}.`,
    );
  }
  return quality;
}

/**
 * Processes one image with the Canvas engine.
 *
 * @example
 * const result = await processImage(file, { format: 'image/webp', quality: 0.8, resize: { width: 1200 } });
 */
export async function processImage(
  input: ImageInput,
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const { signal, onProgress } = options;
  throwIfAborted(signal);

  const format = options.format ?? defaultFormat(input);
  if (!(OUTPUT_FORMATS as readonly string[]).includes(format)) {
    throw new DusrelImageError("unsupported-format", `The Canvas engine cannot encode ${format}.`);
  }
  const quality = validateQuality(options.quality ?? 0.85);

  onProgress?.("decode");
  const decoded = await decodeImage(input, signal ? { signal } : {});
  try {
    throwIfAborted(signal);
    const plan = planTransform({ width: decoded.width, height: decoded.height }, options);
    const steps: string[] = [];
    if (options.crop) steps.push("crop");

    const background =
      options.background !== undefined
        ? options.background
        : format === "image/jpeg"
          ? "#ffffff"
          : null;

    onProgress?.("transform");
    // Stage 1: crop + rotate + flip into the rotated bounding box.
    const stage1 = createCanvas(plan.rotatedSize.width, plan.rotatedSize.height);
    const ctx1 = getContext2d(stage1);
    if (background) {
      ctx1.fillStyle = background;
      ctx1.fillRect(0, 0, plan.rotatedSize.width, plan.rotatedSize.height);
    }
    ctx1.translate(plan.rotatedSize.width / 2, plan.rotatedSize.height / 2);
    if (plan.rotation !== 0) {
      ctx1.rotate((plan.rotation * Math.PI) / 180);
      steps.push("rotate");
    }
    if (options.flipHorizontal || options.flipVertical) {
      ctx1.scale(options.flipHorizontal ? -1 : 1, options.flipVertical ? -1 : 1);
      steps.push("flip");
    }
    ctx1.drawImage(
      decoded.source as CanvasImageSource,
      plan.crop.x,
      plan.crop.y,
      plan.crop.width,
      plan.crop.height,
      -plan.crop.width / 2,
      -plan.crop.height / 2,
      plan.crop.width,
      plan.crop.height,
    );

    // Stage 2: resize (a no-op copy is skipped when sizes already match).
    let output = stage1;
    if (
      plan.outputSize.width !== plan.rotatedSize.width ||
      plan.outputSize.height !== plan.rotatedSize.height
    ) {
      steps.push("resize");
      output = createCanvas(plan.outputSize.width, plan.outputSize.height);
      const ctx2 = getContext2d(output);
      ctx2.imageSmoothingEnabled = true;
      ctx2.imageSmoothingQuality = "high";
      const fit = options.resize?.fit ?? "inside";
      if (fit === "cover") {
        const scale = Math.max(
          plan.outputSize.width / plan.rotatedSize.width,
          plan.outputSize.height / plan.rotatedSize.height,
        );
        const dw = plan.rotatedSize.width * scale;
        const dh = plan.rotatedSize.height * scale;
        ctx2.drawImage(
          stage1 as CanvasImageSource,
          (plan.outputSize.width - dw) / 2,
          (plan.outputSize.height - dh) / 2,
          dw,
          dh,
        );
      } else {
        ctx2.drawImage(
          stage1 as CanvasImageSource,
          0,
          0,
          plan.outputSize.width,
          plan.outputSize.height,
        );
      }
    }

    throwIfAborted(signal);
    onProgress?.("encode");
    let blob: Blob;
    let qualityUsed = quality;
    let targetSizeMet: boolean | undefined;
    if (options.maxSizeBytes !== undefined && format !== "image/png") {
      const search = await findQualityForTargetSize(
        async (q) => {
          const encoded = await encodeCanvas(output, format, q);
          return { value: encoded, sizeBytes: encoded.size };
        },
        options.maxSizeBytes,
        { maxQuality: quality, ...(signal ? { signal } : {}) },
      );
      blob = search.value;
      qualityUsed = search.quality;
      targetSizeMet = search.met;
      steps.push("target-size");
    } else {
      blob = await encodeCanvas(output, format, quality);
    }

    onProgress?.("done");
    const result: ProcessResult = {
      blob,
      format,
      width: plan.outputSize.width,
      height: plan.outputSize.height,
      sizeBytes: blob.size,
      qualityUsed,
      steps,
    };
    if (decoded.originalSizeBytes !== undefined)
      result.originalSizeBytes = decoded.originalSizeBytes;
    if (targetSizeMet !== undefined) result.targetSizeMet = targetSizeMet;
    return result;
  } finally {
    if (decoded.owned && decoded.source instanceof ImageBitmap) {
      decoded.source.close();
    }
  }
}
