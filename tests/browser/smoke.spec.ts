import { expect, test } from "@playwright/test";

// Smoke harness only: proves all three browser engines launch and run JS.
// Real capability checks (createImageBitmap, OffscreenCanvas, WASM) land
// with the Phase 1 test corpus — see docs/TESTING.md.
test("browser engine runs JavaScript", async ({ page }) => {
  await page.goto("about:blank");
  const sum = await page.evaluate(() => 2 + 2);
  expect(sum).toBe(4);
});
