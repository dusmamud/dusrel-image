/**
 * The fluent pro pipeline.
 *
 * Consecutive canvas operations are merged into ONE core pass (one
 * decode, one encode) — chaining `.crop().resize().rotate()` never pays
 * for intermediate encodes. A plugin step is the only thing that splits
 * execution into segments, because it needs real pixels (a Blob) to work
 * on. Segment order is exactly the order the developer wrote.
 */
import type {
  ImageInput,
  OutputFormat,
  ProcessOptions,
  ProcessResult,
  Rect,
  ResizeOptions,
} from "@dusrel/image-core";
import { codecPlugin } from "./codec-plugin.js";
import { processImage } from "./process.js";
import { runPluginSteps } from "./plugins.js";
import { buildReport } from "./report.js";
import type { CodecPluginDefinition, ImageOptions, ImagePlugin, ImageResult } from "./types.js";

export type PipelineOp =
  | { type: "crop"; rect: Rect }
  | { type: "resize"; options: ResizeOptions }
  | { type: "rotate"; degrees: number }
  | { type: "flip"; horizontal?: boolean; vertical?: boolean }
  | { type: "format"; format: OutputFormat; quality?: number }
  | { type: "targetSize"; maxSizeBytes: number }
  | { type: "background"; color: string | null }
  | { type: "plugin"; plugin: ImagePlugin };

export type PipelineSegment =
  | { type: "canvas"; options: ProcessOptions }
  | { type: "plugin"; plugin: ImagePlugin };

/** Merges consecutive canvas ops into single-pass segments (pure). */
export function buildSegments(ops: readonly PipelineOp[]): PipelineSegment[] {
  const segments: PipelineSegment[] = [];
  let current: ProcessOptions | undefined;
  const flush = () => {
    if (current) {
      segments.push({ type: "canvas", options: current });
      current = undefined;
    }
  };
  for (const op of ops) {
    if (op.type === "plugin") {
      flush();
      segments.push({ type: "plugin", plugin: op.plugin });
      continue;
    }
    current ??= {};
    switch (op.type) {
      case "crop":
        current.crop = op.rect;
        break;
      case "resize":
        current.resize = op.options;
        break;
      case "rotate":
        current.rotate = (current.rotate ?? 0) + op.degrees;
        break;
      case "flip":
        if (op.horizontal) current.flipHorizontal = !(current.flipHorizontal ?? false);
        if (op.vertical) current.flipVertical = !(current.flipVertical ?? false);
        break;
      case "format":
        current.format = op.format;
        if (op.quality !== undefined) current.quality = op.quality;
        break;
      case "targetSize":
        current.maxSizeBytes = op.maxSizeBytes;
        break;
      case "background":
        current.background = op.color;
        break;
    }
  }
  flush();
  return segments;
}

export class PipelineBuilder {
  readonly #input: ImageInput;
  readonly #ops: PipelineOp[] = [];

  constructor(input: ImageInput) {
    this.#input = input;
  }

  crop(rect: Rect): this {
    this.#ops.push({ type: "crop", rect });
    return this;
  }

  resize(options: ResizeOptions): this {
    this.#ops.push({ type: "resize", options });
    return this;
  }

  rotate(degrees: number): this {
    this.#ops.push({ type: "rotate", degrees });
    return this;
  }

  flip(horizontal = true, vertical = false): this {
    const op: PipelineOp = { type: "flip" };
    if (horizontal) op.horizontal = true;
    if (vertical) op.vertical = true;
    this.#ops.push(op);
    return this;
  }

  toFormat(format: OutputFormat, quality?: number): this {
    const op: PipelineOp = { type: "format", format };
    if (quality !== undefined) op.quality = quality;
    this.#ops.push(op);
    return this;
  }

  targetSize(maxSizeBytes: number): this {
    this.#ops.push({ type: "targetSize", maxSizeBytes });
    return this;
  }

  background(color: string | null): this {
    this.#ops.push({ type: "background", color });
    return this;
  }

  /** Registers a plugin step at this position in the chain. */
  use(plugin: ImagePlugin): this {
    this.#ops.push({ type: "plugin", plugin });
    return this;
  }

  /**
   * Registers a codec package as the step at this position -
   * sugar for `.use(codecPlugin(def))`. As the last step it is
   * the pipeline's output format (the report's format follows).
   */
  codec(def: CodecPluginDefinition): this {
    return this.use(codecPlugin(def));
  }

  /** The merged execution plan (useful for inspection and tests). */
  plan(): PipelineSegment[] {
    return buildSegments(this.#ops);
  }

  async run(options: ImageOptions = {}): Promise<ImageResult> {
    const started = performance.now();
    const ops = [...this.#ops];
    for (const plugin of options.plugins ?? []) ops.push({ type: "plugin", plugin });
    const segments = buildSegments(ops);
    if (segments.length === 0) segments.push({ type: "canvas", options: {} });

    const runOptions: ImageOptions = { ...options };
    delete runOptions.plugins;

    let current: ImageInput = this.#input;
    let last: ImageResult | undefined;
    let originalBytes: number | undefined;
    let outputFormat: string | undefined;
    const stepsApplied: string[] = [];
    const fallbacks: string[] = [];

    for (const segment of segments) {
      if (segment.type === "canvas") {
        const result = await processImage(current, { ...runOptions, ...segment.options });
        if (originalBytes === undefined && result.originalSizeBytes !== undefined) {
          originalBytes = result.originalSizeBytes;
        }
        stepsApplied.push(...result.report.stepsApplied);
        fallbacks.push(...result.report.fallbacks);
        last = result;
        current = result.blob;
      } else {
        if (!last) {
          // A plugin needs a Blob: materialise the input losslessly first.
          const materialised = await processImage(current, { ...runOptions, format: "image/png" });
          if (originalBytes === undefined && materialised.originalSizeBytes !== undefined) {
            originalBytes = materialised.originalSizeBytes;
          }
          last = materialised;
          current = materialised.blob;
        }
        const stepped = await runPluginSteps(current as Blob, [segment.plugin], {
          previous: last,
          ...(options.signal ? { signal: options.signal } : {}),
        });
        stepsApplied.push(...stepped.steps);
        if (segment.plugin.format) outputFormat = segment.plugin.format;
        last = { ...last, blob: stepped.blob, sizeBytes: stepped.blob.size };
        current = stepped.blob;
      }
    }

    // `last` is an ImageResult; the core-typed record drops its
    // report and keeps the (possibly codec) format via one cast -
    // the public ImageResult below carries the format truthfully
    // as a string.
    const { report: _lastReport, ...lastResult } = last as ImageResult;
    const finalResult: ProcessResult = {
      ...lastResult,
      format: lastResult.format as ProcessResult["format"],
    };
    if (originalBytes !== undefined) finalResult.originalSizeBytes = originalBytes;
    const report = buildReport(finalResult, performance.now() - started, fallbacks);
    report.stepsApplied = stepsApplied;
    if (outputFormat !== undefined) {
      // A codec step set the real output format; the canvas-typed
      // result still names the intermediate - correct the record.
      report.format = outputFormat;
      return { ...finalResult, format: outputFormat, report };
    }
    return { ...finalResult, report };
  }
}

/** Starts a fluent pipeline over one input. */
export function pipeline(input: ImageInput): PipelineBuilder {
  return new PipelineBuilder(input);
}
