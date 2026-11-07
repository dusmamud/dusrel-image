/** Report construction (pure; unit tested in Node). */
import type { ProcessResult } from "@dusrel/image-core";
import type { ProcessReport } from "./types.js";

export function buildReport(
  result: ProcessResult,
  durationMs: number,
  fallbacks: string[],
): ProcessReport {
  const report: ProcessReport = {
    engine: "canvas",
    finalBytes: result.sizeBytes,
    width: result.width,
    height: result.height,
    format: result.format,
    stepsApplied: result.steps,
    durationMs: Math.max(0, Math.round(durationMs)),
    fallbacks,
  };
  if (result.originalSizeBytes !== undefined) {
    report.originalBytes = result.originalSizeBytes;
    if (result.originalSizeBytes > 0) {
      report.savingsRatio =
        (result.originalSizeBytes - result.sizeBytes) / result.originalSizeBytes;
    }
  }
  return report;
}
