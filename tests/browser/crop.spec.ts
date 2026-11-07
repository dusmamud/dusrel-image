import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Real-browser proof for @dusrel/image-crop: the geometry maths
// is unit-proven in Node; here the actual Web Component renders
// in real engines — image load, initial crop event, keyboard
// interaction, and aspect locking through attributes.
const elementBundle = readFileSync(
  new URL("../../packages/features/crop/dist/element.js", import.meta.url),
  "utf8",
);

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await page.evaluate((content) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/javascript" }));
    (window as unknown as { __cUrl: string }).__cUrl = url;
  }, elementBundle);
});

async function mountCrop(page: Page, extraAttrs = "") {
  return page.evaluate(async (attrs) => {
    const w = window as unknown as {
      __cUrl: string;
      __cropEl: HTMLElement & { value: { x: number; y: number; width: number; height: number } };
      __events: Array<{ x: number; y: number; width: number; height: number }>;
    };
    const mod = (await import(
      w.__cUrl
    )) as typeof import("../../packages/features/crop/src/element.js");
    mod.defineCropElement();
    // An 800x600 test image (two-tone canvas PNG).
    const canvas = new OffscreenCanvas(800, 600);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgb(30, 100, 200)";
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = "rgb(250, 200, 40)";
    ctx.fillRect(400, 0, 400, 600);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const src = URL.createObjectURL(blob);
    const el = document.createElement("dusrel-crop") as HTMLElement & {
      value: { x: number; y: number; width: number; height: number };
    };
    el.setAttribute("src", src);
    if (attrs) {
      for (const pair of attrs.split(" ")) {
        const [k, v] = pair.split("=") as [string, string];
        el.setAttribute(k, v!);
      }
    }
    el.style.width = "400px";
    el.style.height = "300px";
    el.style.display = "block";
    const events: Array<{ x: number; y: number; width: number; height: number }> = [];
    el.addEventListener("crop-change", (e) => {
      events.push({ ...(e as CustomEvent<{ crop: typeof el.value }>).detail.crop });
    });
    document.body.appendChild(el);
    w.__cropEl = el;
    w.__events = events;
    // Wait for the image load -> initial crop event.
    for (let i = 0; i < 50 && events.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return { initial: el.value, eventCount: events.length };
  }, extraAttrs);
}

test("initial crop is the centred 80% in natural pixels", async ({ page }) => {
  const r = await mountCrop(page);
  expect(r.eventCount).toBeGreaterThanOrEqual(1);
  expect(r.initial).toEqual({ x: 80, y: 60, width: 640, height: 480 });
});

test("keyboard: arrows move the crop by natural pixels and emit events", async ({ page }) => {
  await mountCrop(page);
  await page.evaluate(() => {
    const w = window as unknown as { __cropEl: HTMLElement };
    const box = w.__cropEl.shadowRoot!.querySelector('[data-part="box"]') as HTMLElement;
    box.focus();
  });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const r = await page.evaluate(() => {
    const w = window as unknown as {
      __cropEl: HTMLElement & { value: { x: number; y: number; width: number; height: number } };
      __events: unknown[];
    };
    return { value: w.__cropEl.value, eventCount: w.__events.length };
  });
  expect(r.value.x).toBe(82); // +1 +1 natural px
  expect(r.value.y).toBe(70); // Shift = +10
  expect(r.eventCount).toBeGreaterThanOrEqual(4); // initial + 3 keys
});

test("aspect attribute locks the crop ratio", async ({ page }) => {
  const r = await mountCrop(page, "aspect=1/1");
  expect(r.initial.width).toBe(r.initial.height);
  // 80% coverage box is 640x480; a square fits at 480x480 centred.
  expect(r.initial.width).toBe(480);
  expect(r.initial.x).toBe(160);
});
