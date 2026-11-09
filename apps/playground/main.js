// @dusrel/image playground — every control below maps to a real
// package in this repo. All processing happens in this tab.
import {
  blobToImageData,
  codecPlugin,
  imageDataPlugin,
  pipeline,
  processBatch,
} from "@dusrel/image";
import { adjust } from "@dusrel/image-adjust";
import { drawTextWatermark } from "@dusrel/image-watermark";
import { readMetadata } from "@dusrel/image-metadata";
import { defineCropElement } from "@dusrel/image-crop/element";
import { encode as encodeAvif } from "@dusrel/image-avif";
import { encode as encodeWebp } from "@dusrel/image-webp";
import { encode as encodeJpeg } from "@dusrel/image-jpeg";
import { encode as encodePng } from "@dusrel/image-png";
import { encode as encodeJxl } from "@dusrel/image-jxl";
import { encode as encodeQoi } from "@dusrel/image-qoi";
import { encode as encodeGif } from "@dusrel/image-gif";
import { optimize as optimizePng } from "@dusrel/image-oxipng";
import {
  decodeThumbHash,
  encodeBlurHash,
  encodeThumbHash,
  thumbHashToBase64,
} from "@dusrel/image-placeholder";
import { decodeHeic, isHeic } from "@dusrel/image-heic";

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
  rotate: $("rotate"),
  flipH: $("flipH"),
  flipV: $("flipV"),
  useOxipng: $("useOxipng"),
  loadSample: $("loadSample"),
  loadHeic: $("loadHeic"),
  genHashes: $("genHashes"),
  hashOut: $("hashOut"),
  thumbHash: $("thumbHash"),
  blurHash: $("blurHash"),
  thumbPreview: $("thumbPreview"),
};

let currentFile = null;
let currentUrl = null;

const fmtBytes = (n) => (n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);
const jsonSafe = (value) =>
  JSON.stringify(value, (_key, v) => (v instanceof Uint8Array ? `[${v.length} bytes]` : v), 2);

async function loadFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let note = "";
  if (isHeic(bytes)) {
    // Most browsers cannot decode HEIC — the WASM decoder turns it
    // into pixels, and every tool then works on the decoded image.
    const img = await decodeHeic(bytes);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d").putImageData(img, 0, 0);
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))),
        "image/png",
      ),
    );
    file = new File([blob], file.name.replace(/\.hei[cf]$/i, ".png"), { type: "image/png" });
    note =
      "HEIC decoded in-browser via @dusrel/image-heic (WASM). Tools run on the decoded pixels.\n\n";
  }
  currentFile = file;
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = URL.createObjectURL(file);
  els.cropper.setAttribute("src", currentUrl);
  els.stage.hidden = false;
  els.process.disabled = false;
  els.genHashes.disabled = false;
  els.metaOut.textContent = note + jsonSafe(readMetadata(bytes));
}

els.loadSample.addEventListener("click", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 640, 400);
  grad.addColorStop(0, "#e2552f");
  grad.addColorStop(0.5, "#2f9ee2");
  grad.addColorStop(1, "#37d67a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 640, 400);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText("@dusrel/image sample", 28, 56);
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))), "image/png"),
  );
  await loadFile(new File([blob], "sample.png", { type: "image/png" }));
});

els.loadHeic.addEventListener("click", async () => {
  // Deployed site: ./sample.heic (copied in at build). Repo checkout:
  // the codec package's test fixture.
  for (const url of ["./sample.heic", "../../packages/codecs/heic/test/fixture.heic"]) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        await loadFile(new File([await res.blob()], "sample.heic", { type: "image/heic" }));
        return;
      }
    } catch {
      /* try the next location */
    }
  }
  els.metaOut.textContent = "sample.heic could not be fetched from either location.";
});

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
  "wasm-png": { mimeType: "image/png", encode: (d) => encodePng(d) },
  "wasm-jxl": { mimeType: "image/jxl", encode: (d, q) => encodeJxl(d, { quality: q }) },
  "wasm-qoi": { mimeType: "image/qoi", encode: (d) => encodeQoi(d) },
  "wasm-gif": {
    mimeType: "image/gif",
    encode: async (d) => encodeGif([{ data: d }]),
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
    const rotate = Number(els.rotate.value);
    if (rotate !== 0) builder.rotate(rotate);
    if (els.flipH.checked || els.flipV.checked) {
      builder.flip(els.flipH.checked, els.flipV.checked);
    }
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
    const result = await builder.run({
      onProgress: (v) => {
        const n = Number(v);
        if (Number.isFinite(n)) els.progress.value = Math.min(1, Math.max(0, n));
      },
    });
    let blob = result.blob;
    const report = result.report;
    if (els.useOxipng.checked && blob.type === "image/png") {
      const optimised = await optimizePng(new Uint8Array(await blob.arrayBuffer()));
      blob = new Blob([optimised], { type: "image/png" });
    }
    const url = URL.createObjectURL(blob);
    const displayable = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/gif",
    ].includes(blob.type);
    els.outImg.hidden = !displayable;
    els.outImg.src = url;
    els.download.href = url;
    els.summary.textContent =
      `${currentFile.name}: ${fmtBytes(currentFile.size)} → ${fmtBytes(blob.size)} ` +
      `(${blob.type || format})` +
      (displayable ? "" : " — this browser cannot preview that format; use Download.");
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

els.genHashes.addEventListener("click", async () => {
  if (!currentFile) return;
  els.genHashes.disabled = true;
  try {
    const img = await blobToImageData(currentFile);
    const pixels = { data: img.data, width: img.width, height: img.height };
    const thumb = encodeThumbHash(pixels);
    els.thumbHash.textContent = thumbHashToBase64(thumb);
    els.blurHash.textContent = encodeBlurHash(pixels);
    const back = decodeThumbHash(thumb);
    const canvas = els.thumbPreview;
    const scale = Math.min(canvas.width / back.width, canvas.height / back.height);
    const w = Math.max(1, Math.round(back.width * scale));
    const h = Math.max(1, Math.round(back.height * scale));
    const tmp = document.createElement("canvas");
    tmp.width = back.width;
    tmp.height = back.height;
    tmp.getContext("2d").putImageData(new ImageData(back.data, back.width, back.height), 0, 0);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, 0, 0, w, h);
    els.hashOut.hidden = false;
  } catch (error) {
    els.thumbHash.textContent = String(error);
    els.hashOut.hidden = false;
  } finally {
    els.genHashes.disabled = false;
  }
});
