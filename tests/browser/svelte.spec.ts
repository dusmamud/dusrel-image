import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Real-browser proof for @dusrel/image-svelte: the fixture
// mounts the REAL DusrelCrop component (compiled ahead of
// bundling by the package's own compile-fixture script) and
// drives createProcessImage stores end-to-end.
const fixture = readFileSync(
  new URL("../../packages/frameworks/svelte/test/.fixture/browser-fixture.js", import.meta.url),
  "utf8",
);

test("Svelte bindings: compiled crop component relays events, stores process end-to-end", async ({
  page,
}) => {
  await page.goto("about:blank");
  await page.evaluate(() => {
    document.body.innerHTML =
      '<div id="root"></div><div data-testid="crop">none</div>' +
      '<button data-testid="go" disabled>Process</button>' +
      '<div data-testid="status">idle</div><div data-testid="result">none</div>';
  });
  await page.evaluate((content) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/javascript" }));
    return import(url);
  }, fixture);

  try {
    await expect(page.getByTestId("crop")).toContainText('"width":640', { timeout: 15_000 });
  } catch {
    // Surface the live DOM state in the failure — WebKit caught a
    // silent no-mount here once, and the snapshot explains more
    // than the assertion diff.
    const diag = await page.evaluate(() => {
      const el = document.querySelector("dusrel-crop") as unknown as {
        shadowRoot?: ShadowRoot | null;
        value?: unknown;
        getAttribute(name: string): string | null;
      } | null;
      return {
        hasEl: !!el,
        defined: !!customElements.get("dusrel-crop"),
        hasShadow: !!el?.shadowRoot,
        value: el?.value ?? null,
        srcAttr: el?.getAttribute("src")?.slice(0, 24) ?? null,
        goDisabled: (document.querySelector('[data-testid="go"]') as HTMLButtonElement)?.disabled,
        rootChildren: document.getElementById("root")?.childElementCount,
      };
    });
    throw new Error(`crop never arrived; diagnostics: ${JSON.stringify(diag)}`);
  }
  await expect(page.getByTestId("crop")).toContainText('"height":480');

  await page.getByTestId("go").click();
  await expect(page.getByTestId("status")).toHaveText("success", { timeout: 15_000 });
  const result = await page.getByTestId("result").textContent();
  expect(result).toMatch(/^image\/webp:\d+:/);
});
