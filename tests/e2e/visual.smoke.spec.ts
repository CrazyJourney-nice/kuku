import { expect, test } from "@playwright/test";

test("@visual matches all seven product screens", async ({ page }) => {
  const settleTransition = async () => {
    await page.clock.fastForward(700);
  };

  const capture = async (name: string) => {
    await page.waitForFunction(() =>
      Array.from(document.images).every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
    await expect(page.locator(".slice-asset--fallback")).toHaveCount(0);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixelRatio: 0.01,
    });
  };

  await page.goto("/?visual=1");
  await expect(page.getByTestId("screen-welcome")).toBeVisible();
  await expect(page.getByTestId("start-intro")).toBeEnabled();
  // Install deterministic time after the real initialization handshake.
  // Installing before navigation would also freeze React's client effects.
  await page.clock.install({
    time: new Date("2026-07-26T10:00:00.000Z"),
  });
  await capture("k1-welcome");
  await page.getByTestId("start-intro").click();
  await settleTransition();
  await expect(page.getByTestId("start-order")).toBeEnabled();
  await capture("k2-impact");
  await page.getByTestId("start-order").click();
  await settleTransition();
  await expect(page.getByTestId("screen-drink")).toBeVisible();
  await capture("k3-drink");
  await page.getByTestId("drink-mocha").click();
  await page.getByTestId("continue-customize").click();
  await settleTransition();
  await expect(page.getByTestId("screen-customize")).toBeVisible();
  await capture("k4-customize");
  await expect(page.getByTestId("continue-confirm")).toBeEnabled();
  await page.getByTestId("continue-confirm").click();
  await settleTransition();
  await expect(page.getByTestId("screen-confirm")).toBeVisible();
  await capture("k5-confirm");
  await expect(page.getByTestId("submit-order")).toBeEnabled();
  await page.getByTestId("submit-order").click();
  await expect(page.getByTestId("screen-brewing")).toBeVisible();
  await settleTransition();
  await capture("k6-brewing");
  await page.clock.fastForward(50_000);
  await expect(page.getByTestId("screen-pickup")).toBeVisible({
    timeout: 8_000,
  });
  await capture("k7-pickup");
});
