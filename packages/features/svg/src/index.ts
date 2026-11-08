/**
 * @dusrel/image-svg
 *
 * SVG optimisation via SVGO's browser build (v4): preset-default
 * plugins, multipass on by default, ID preservation options, and
 * a full plugin passthrough for maximum control. Synchronous —
 * SVGO itself is synchronous.
 */
export { optimizeSvg, optimizeSvgWithStats, resolveSvgOptions } from "./optimize.js";
export type {
  PluginConfig,
  ResolvedSvgConfig,
  SvgOptimizeOptions,
  SvgOptimizeResult,
} from "./types.js";
