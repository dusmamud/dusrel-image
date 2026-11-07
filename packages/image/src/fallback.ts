/**
 * Fallback policy machinery (pure helpers, unit tested in Node).
 */
import type { OutputFormat } from "@dusrel/image-core";
import type { FallbackPolicy } from "./types.js";

/** The downgrade chain: each format falls to the next, PNG is the floor. */
const CHAIN: readonly OutputFormat[] = ["image/webp", "image/jpeg", "image/png"];

/** Formats to try after `format`, in order, under `downgrade-format`. */
export function downgradeChain(format: OutputFormat): OutputFormat[] {
  const index = CHAIN.indexOf(format);
  if (index === -1) return [];
  return CHAIN.slice(index + 1);
}

export function isFallbackPolicy(value: unknown): value is FallbackPolicy {
  return value === "throw" || value === "return-original" || value === "downgrade-format";
}
