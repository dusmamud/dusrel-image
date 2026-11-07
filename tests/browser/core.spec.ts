import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Loads the BUILT @dusrel/image-core bundle into a real browser page and
// runs the actual Canvas pipeline end to end. Run `pnpm build` first
// (the browser-tests workflow does).
const coreBundle = readFileSync(
  new URL("../../packages/core/dist/index.js", import.meta.url),
  "utf8",
);

test("processImage: resize + convert a generated PNG in a real browser", async ({ page }) => {
  const result = await page.evaluate(async (bundle: string) => {
    const blob = new Blob([bundle], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const core = (await import(url)) as typeof import("../../packages/core/src/index.js");
    URL.revokeObjectURL(url);

    // Source: 400x200 gradient PNG made in the page.
    const src = new OffscreenCanvas(400, 200);
    const ctx = src.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 400, 200);
    gradient.addColorStop(0, "#ff0044");
    gradient.addColorStop(1, "#0044ff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 200);
    const png = await src.convertToBlob({ type: "image/png" });

    // Try WebP; on engines without WebP canvas encode, the typed
    // unsupported-format error must surface and we fall back to JPEG —
    // the cascade is part of the contract being tested.
    let usedFallback = false;
    let out;
    try {
      out = await core.processImage(png, {
        format: "image/webp",
        quality: 0.8,
        resize: { width: 100 },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "unsupported-format") throw error;
      usedFallback = true;
      out = await core.processImage(png, {
        format: "image/jpeg",
        quality: 0.8,
        resize: { width: 100 },
      });
    }

    const check = await createImageBitmap(out.blob);
    return {
      format: out.format,
      width: out.width,
      height: out.height,
      decodedWidth: check.width,
      sizeBytes: out.sizeBytes,
      originalSizeBytes: out.originalSizeBytes ?? -1,
      usedFallback,
    };
  }, coreBundle);

  expect(result.width).toBe(100);
  expect(result.height).toBe(50);
  expect(result.decodedWidth).toBe(100);
  expect(result.originalSizeBytes).toBeGreaterThan(0);
  expect(result.sizeBytes).toBeGreaterThan(0);
  expect(["image/webp", "image/jpeg"]).toContain(result.format);
});

test("processImage: crop outside the source is a typed invalid-options error", async ({ page }) => {
  const code = await page.evaluate(async (bundle: string) => {
    const blob = new Blob([bundle], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const core = (await import(url)) as typeof import("../../packages/core/src/index.js");
    URL.revokeObjectURL(url);
    const src = new OffscreenCanvas(100, 100);
    src.getContext("2d")!.fillRect(0, 0, 100, 100);
    const png = await src.convertToBlob({ type: "image/png" });
    try {
      await core.processImage(png, { crop: { x: 50, y: 0, width: 100, height: 50 } });
      return "no-error";
    } catch (error) {
      return (error as { code?: string }).code ?? "unknown";
    }
  }, coreBundle);
  expect(code).toBe("invalid-options");
});
