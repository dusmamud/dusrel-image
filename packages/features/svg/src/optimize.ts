import { optimize as svgoOptimize, type Config } from "svgo/browser";
import type { SvgOptimizeOptions, SvgOptimizeResult } from "./types.js";

/**
 * Resolves our options to an SVGO config (pure; unit tested).
 * Default: SVGO's preset-default with multipass on.
 */
export function resolveSvgOptions(options: SvgOptimizeOptions = {}): Config {
  const config: Config = { multipass: options.multipass ?? true };
  if (options.path !== undefined) config.path = options.path;
  if (options.plugins !== undefined) {
    config.plugins = options.plugins;
  } else if (options.preserveIds) {
    config.plugins = [{ name: "preset-default", params: { overrides: { cleanupIds: false } } }];
  } else if (options.preserve !== undefined && options.preserve.length > 0) {
    config.plugins = [
      {
        name: "preset-default",
        params: { overrides: { cleanupIds: { preserve: [...options.preserve] } } },
      },
    ];
  } else {
    config.plugins = ["preset-default"];
  }
  if (options.pretty) config.js2svg = { pretty: true, indent: "  " };
  return config;
}

/**
 * Optimises an SVG string with SVGO's browser build. Throws on
 * malformed input (SVGO's parse error) and on empty input.
 */
export function optimizeSvg(svg: string, options: SvgOptimizeOptions = {}): string {
  return optimizeSvgWithStats(svg, options).svg;
}

/** Like optimizeSvg, with UTF-8 byte counts and the savings ratio. */
export function optimizeSvgWithStats(
  svg: string,
  options: SvgOptimizeOptions = {},
): SvgOptimizeResult {
  if (typeof svg !== "string" || svg.trim().length === 0) {
    throw new RangeError("optimizeSvg needs a non-empty SVG string.");
  }
  const { data } = svgoOptimize(svg, resolveSvgOptions(options));
  const encoder = new TextEncoder();
  const originalBytes = encoder.encode(svg).length;
  const outputBytes = encoder.encode(data).length;
  return {
    svg: data,
    originalBytes,
    outputBytes,
    savingsRatio: originalBytes === 0 ? 0 : (originalBytes - outputBytes) / originalBytes,
  };
}
