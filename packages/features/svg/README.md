# @dusrel/image-svg

SVG optimisation via SVGO's browser build (v4.1.0, MIT) —
preset-default plugins, multipass on, ID/class preservation
options, and a full SVGO plugin passthrough when you want total
control. Synchronous, like SVGO itself.

```ts
import { optimizeSvg, optimizeSvgWithStats } from "@dusrel/image-svg";

const out = optimizeSvg(svgText);
const { svg, originalBytes, outputBytes, savingsRatio } =
  optimizeSvgWithStats(svgText, { preserveIds: true });
```

Options (maximum control, easy defaults):

- `multipass` (default `true`): rerun SVGO until the output
  stops changing — where the last few percent come from.
- `preserveIds` (default `false`): SVGO's preset removes unused
  IDs and minifies referenced ones. Right for standalone files;
  wrong when CSS, JS or a `#fragment` URL points at the IDs.
  `true` disables cleanupIds entirely.
- `preserve`: specific IDs cleanupIds must keep untouched,
  while the rest are still optimised.
- `plugins`: a complete SVGO `PluginConfig[]` that replaces the
  preset — every built-in plugin (and its params) is available.
- `pretty`: pretty-printed output (2-space indent) for SVGs
  humans will keep editing.
- `path`: a path hint for SVGO's error messages.

Unlike the codec packages there is no WASM here: SVGO ships as
a regular dependency and stays external in this package's dist,
so your bundler dedupes it if you also use SVGO directly. The
browser test fixture bundles it, purely so Playwright can load
the package from a Blob URL.
