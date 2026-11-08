/**
 * The plugin runtime shared by easy mode and the pipeline
 * (docs/API_DESIGN.md section 6, stabilised in ADR-0007):
 * plugins run only when registered, failures surface as typed
 * errors with stable codes, and a registered codec can serve as
 * the output format.
 */
import { DusrelImageError } from "@dusrel/image-core";
import { codecPlugin, resolveCodecPluginName } from "./codec-plugin.js";
import type { CodecPluginDefinition, ImagePlugin, PluginContext } from "./types.js";

/**
 * Normalises a plugin failure into the family's typed error
 * shape (pure; unit tested):
 * - a DusrelImageError passes through untouched;
 * - an abort (signal fired, or an AbortError) becomes `aborted`;
 * - anything else becomes `plugin-failed`, naming the plugin,
 *   with the original error preserved as `cause`.
 */
export function wrapPluginError(
  pluginName: string,
  cause: unknown,
  signal?: AbortSignal,
): DusrelImageError {
  if (cause instanceof DusrelImageError) return cause;
  const isAbort =
    signal?.aborted === true ||
    (cause instanceof Error && (cause.name === "AbortError" || cause.name === "TimeoutError"));
  if (isAbort) {
    return new DusrelImageError("aborted", `Plugin "${pluginName}" was aborted.`, { cause });
  }
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new DusrelImageError("plugin-failed", `Plugin "${pluginName}" failed: ${detail}`, {
    cause,
  });
}

/**
 * Runs plugin steps in order over a Blob, recording the report
 * step names (`plugin:<name>`). The first failure aborts the
 * chain (wrapped by wrapPluginError).
 */
export async function runPluginSteps(
  blob: Blob,
  plugins: ImagePlugin[],
  context: PluginContext,
): Promise<{ blob: Blob; steps: string[] }> {
  let current = blob;
  const steps: string[] = [];
  for (const plugin of plugins) {
    try {
      current = await plugin.apply(current, context);
    } catch (cause) {
      throw wrapPluginError(plugin.name, cause, context.signal);
    }
    steps.push(`plugin:${plugin.name}`);
  }
  return { blob: current, steps };
}

/** Finds the codec registered for a MIME type (pure; unit tested). */
export function findCodec(
  codecs: CodecPluginDefinition[] | undefined,
  mimeType: string,
): CodecPluginDefinition | undefined {
  return codecs?.find((codec) => codec.mimeType.toLowerCase() === mimeType.toLowerCase());
}

/**
 * Encodes a Blob with a registered codec definition (decode to
 * pixels, codec encode, re-wrap). Errors are wrapped with the
 * codec's resolved step name, like any plugin failure.
 */
export async function encodeViaCodec(
  blob: Blob,
  def: CodecPluginDefinition,
  context: PluginContext,
): Promise<Blob> {
  const plugin = codecPlugin(def);
  try {
    return await plugin.apply(blob, context);
  } catch (cause) {
    throw wrapPluginError(resolveCodecPluginName(def), cause, context.signal);
  }
}
