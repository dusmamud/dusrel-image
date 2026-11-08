// Self-contained fixture for the Playwright spec: exposes the
// package on window so the spec can load it from a Blob URL.
import * as svg from "../src/index.js";

(window as unknown as { __svg: typeof svg }).__svg = svg;
