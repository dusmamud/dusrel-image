import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Real-browser proof for @dusrel/image-react: a self-contained
// React fixture app (built by the package's own tsdown fixture
// config) mounts in the real engine — the <DusrelCrop> wrapper
// registers the Web Component and relays its crop-change into
// React state, and useProcessImage processes the image
// end-to-end (with that crop applied) through @dusrel/image.
const fixture = readFileSync(
  new URL("../../packages/frameworks/react/test/.fixture/browser-fixture.js", import.meta.url),
  "utf8",
);

test("React bindings: crop component relays state, hook processes end-to-end", async ({ page }) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });
  await page.evaluate((content) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/javascript" }));
    return import(url);
  }, fixture);

  // The crop component loads its image and the initial crop
  // (centred 80% of 800x600) reaches React state.
  await expect(page.getByTestId("crop")).toContainText('"width":640', { timeout: 15_000 });
  await expect(page.getByTestId("crop")).toContainText('"height":480');

  // The hook processes the image (crop applied) to WebP.
  await page.getByTestId("go").click();
  await expect(page.getByTestId("status")).toHaveText("success", { timeout: 15_000 });
  const result = await page.getByTestId("result").textContent();
  expect(result).toMatch(/^image\/webp:\d+:/);
});
