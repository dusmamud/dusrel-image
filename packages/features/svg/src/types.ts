/** Public types for @dusrel/image-svg (SVGO browser build). */
import type { Config, PluginConfig } from "svgo/browser";

export type { PluginConfig };

export interface SvgOptimizeOptions {
  /**
   * Run SVGO until the output stops changing. Default true
   * (SVGO's own CLI default is a single pass; repeated passes are
   * where the last few percent come from).
   */
  multipass?: boolean;
  /**
   * Keep every element ID exactly as written. Default false:
   * SVGO's preset removes unused IDs and minifies referenced
   * ones — right for standalone files, wrong when CSS/JS or a
   * URL fragment references the IDs. Set true to disable
   * cleanupIds entirely.
   */
  preserveIds?: boolean;
  /**
   * Specific IDs cleanupIds must keep (and not minify), while
   * other IDs are still optimised. Ignored when `preserveIds`
   * is true.
   */
  preserve?: string[];
  /**
   * Full SVGO plugin configuration — replaces the default
   * preset entirely (maximum control; `preserveIds`/`preserve`
   * are ignored). Strings name built-in plugins; objects carry
   * params.
   */
  plugins?: PluginConfig[];
  /** Pretty-print the output (2-space indent). Default false. */
  pretty?: boolean;
  /** Path hint used in SVGO error messages. */
  path?: string;
}

export interface SvgOptimizeResult {
  svg: string;
  originalBytes: number;
  outputBytes: number;
  /** (original - output) / original; negative if the file grew. */
  savingsRatio: number;
}

/** The SVGO config an options object resolves to (see resolveSvgOptions). */
export type ResolvedSvgConfig = Config;
