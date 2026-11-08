import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Real-browser proof for @dusrel/image-vue: a self-contained
// Vue fixture app (built by the package's own tsdown fixture
// config) mounts in the real engine — the DusrelCrop component
// registers the Web Component and its crop-change reaches Vue
// state, and useProcessImage processes the image end-to-end
// (with that crop applied) through @dusrel/image.
const fixture = readFileSync(
  new URL("../../packages/frameworks/vue/test/.fixture/browser-fixture.js", import.meta.url),
  "utf8",
);

test("Vue bindings: crop component relays state, composable processes end-to-end", async ({
  page,
}) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });
  await page.evaluate((content) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/javascript" }));
    return import(url);
  }, fixture);

  await expect(page.getByTestId("crop")).toContainText('"width":640', { timeout: 15_000 });
  await expect(page.getByTestId("crop")).toContainText('"height":480');

  await page.getByTestId("go").click();
  await expect(page.getByTestId("status")).toHaveText("success", { timeout: 15_000 });
  const result = await page.getByTestId("result").textContent();
  expect(result).toMatch(/^image\/webp:\d+:/);
});
