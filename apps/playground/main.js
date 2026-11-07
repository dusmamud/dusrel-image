// @dusrel/image playground — every control below maps to a real
// package in this repo. All processing happens in this tab.
import { codecPlugin, imageDataPlugin, pipeline, processBatch } from "@dusrel/image";
import { adjust } from "@dusrel/image-adjust";
import { drawTextWatermark } from "@dusrel/image-watermark";
import { readMetadata } from "@dusrel/image-metadata";
import { defineCropElement } from "@dusrel/image-crop/element";
import { encode as encodeAvif } from "@dusrel/image-avif";
import { encode as encodeWebp } from "@dusrel/image-webp";
import { encode as encodeJpeg } from "@dusrel/image-jpeg";

defineCropElement();

const $ = (id) => document.getElementById(id);
const els = {
  file: $("file"),
  stage: $("stage"),
  cropper: $("cropper"),
  useCrop: $("useCrop"),
  aspect: $("aspect"),
  metaOut: $("metaOut"),
  format: $("format"),
  quality: $("quality"),
  qualityVal: $("qualityVal"),
  maxWidth: $("maxWidth"),
  brightness: $("brightness"),
  contrast: $("contrast"),
  saturation: $("saturation"),
  watermark: $("watermark"),
  process: $("process"),
  progress: $("progress"),
  result: $("result"),
  outImg: $("outImg"),
  summary: $("summary"),
  download: $("download"),
  reportOut: $("reportOut"),
  batchFiles: $("batchFiles"),
  runBatch: $("runBatch"),
  batchProgress: $("batchProgress"),
  batchOut: $("batchOut"),
};

let currentFile = null;
let currentUrl = null;

const fmtBytes = (n) => (n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);
const jsonSafe = (value) =>
  JSON.stringify(value, (_key, v) => (v instanceof Uint8Array ? `[${v.length} bytes]` : v), 2);

async function loadFile(file) {
  currentFile = file;
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = URL.createObjectURL(file);
  els.cropper.setAttribute("src", currentUrl);
  els.stage.hidden = false;
  els.process.disabled = false;
  const bytes = new Uint8Array(await file.arrayBuffer());
  els.metaOut.textContent = jsonSafe(readMetadata(bytes));
}

els.file.addEventListener("change", () => {
  if (els.file.files[0]) void loadFile(els.file.files[0]);
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) void loadFile(file);
});
els.aspect.addEventListener("change", () => {
  if (els.aspect.value) els.cropper.setAttribute("aspect", els.aspect.value);
  else els.cropper.removeAttribute("aspect");
});
els.quality.addEventListener("input", () => {
  els.qualityVal.textContent = els.quality.value;
});

const WASM_FORMATS = {
  "wasm-webp": { mimeType: "image/webp", encode: (d, q) => encodeWebp(d, { quality: q }) },
  "wasm-jpeg": { mimeType: "image/jpeg", encode: (d, q) => encodeJpeg(d, { quality: q }) },
  "wasm-avif": {
    mimeType: "image/avif",
    encode: (d, q) => encodeAvif(d, { quality: q, speed: 9 }),
  },
};

els.process.addEventListener("click", async () => {
  if (!currentFile) return;
  els.process.disabled = true;
  els.progress.hidden = false;
  els.progress.value = 0;
  try {
    const quality = Number(els.quality.value);
    const builder = pipeline(currentFile);
    if (els.useCrop.checked && els.cropper.value.width > 0) {
      builder.crop(els.cropper.value);
    }
    const maxWidth = Number(els.maxWidth.value);
    if (maxWidth > 0) builder.resize({ width: maxWidth });
    const adj = {
      brightness: Number(els.brightness.value) / 100,
      contrast: Number(els.contrast.value) / 100,
      saturation: Number(els.saturation.value) / 100,
    };
    if (adj.brightness !== 0 || adj.contrast !== 0 || adj.saturation !== 0) {
      builder.use(imageDataPlugin({ name: "adjust", transform: (d) => adjust(d, adj) }));
    }
    const wm = els.watermark.value.trim();
    if (wm) {
      builder.use(
        imageDataPlugin({
          name: "watermark",
          transform: (d) => drawTextWatermark(d, wm, { position: "bottom-right" }),
        }),
      );
    }
    const format = els.format.value;
    const wasm = WASM_FORMATS[format];
    if (wasm) {
      builder.use(codecPlugin({ mimeType: wasm.mimeType, encode: (d) => wasm.encode(d, quality) }));
    } else {
      builder.toFormat(format, quality / 100);
    }
    const { blob, report } = await builder.run({
      onProgress: (v) => {
        const n = Number(v);
        if (Number.isFinite(n)) els.progress.value = Math.min(1, Math.max(0, n));
      },
    });
    const url = URL.createObjectURL(blob);
    els.outImg.src = url;
    els.download.href = url;
    els.summary.textContent =
      `${currentFile.name}: ${fmtBytes(currentFile.size)} → ${fmtBytes(blob.size)} ` +
      `(${blob.type || format})`;
    els.reportOut.textContent = jsonSafe(report);
    els.result.hidden = false;
  } catch (error) {
    els.reportOut.textContent = String(error);
    els.result.hidden = false;
  } finally {
    els.progress.hidden = true;
    els.process.disabled = false;
  }
});

els.batchFiles.addEventListener("change", () => {
  els.runBatch.disabled = els.batchFiles.files.length === 0;
});
els.runBatch.addEventListener("click", async () => {
  const files = [...els.batchFiles.files];
  els.runBatch.disabled = true;
  els.batchProgress.hidden = false;
  els.batchProgress.value = 0;
  els.batchOut.innerHTML = "";
  const results = await processBatch(files, {
    format: "image/webp",
    quality: 0.8,
    concurrency: 3,
    onBatchProgress: (p) => {
      if (p && typeof p.completed === "number" && typeof p.total === "number" && p.total > 0) {
        els.batchProgress.value = p.completed / p.total;
      }
    },
  });
  for (const item of results) {
    const li = document.createElement("li");
    const name = files[item.index]?.name ?? `file ${item.index}`;
    li.textContent =
      item.status === "fulfilled"
        ? `${name}: ${fmtBytes(files[item.index].size)} → ${fmtBytes(item.result.blob.size)}`
        : `${name}: FAILED — ${String(item.error)}`;
    els.batchOut.appendChild(li);
  }
  els.batchProgress.hidden = true;
  els.runBatch.disabled = false;
});
