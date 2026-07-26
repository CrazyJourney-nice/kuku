import { expect, test } from "@playwright/test";

const cycles = Number.parseInt(process.env.KUKU_SOAK_CYCLES ?? "3", 10);

test("@soak repeats complete sessions without leaving DOM growth", async ({
  page,
}) => {
  test.skip(
    !Number.isSafeInteger(cycles) || cycles < 1,
    "KUKU_SOAK_CYCLES must be a positive integer",
  );

  let baselineNodes: number | null = null;
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    await page.goto("/");
    await page.getByTestId("start-intro").click();
    await expect(page.getByTestId("start-order")).toBeEnabled();
    await page.getByTestId("start-order").click();
    await page.getByTestId("drink-americano").click();
    await page.getByTestId("continue-customize").click();
    await expect(page.getByTestId("continue-confirm")).toBeEnabled();
    await page.getByTestId("continue-confirm").click();
    await expect(page.getByTestId("submit-order")).toBeEnabled();
    await page.getByTestId("submit-order").click();
    await expect(page.getByTestId("screen-pickup")).toBeVisible({
      timeout: 8_000,
    });
    await page.getByTestId("finish-session").click();
    await expect(page.getByTestId("screen-welcome")).toBeVisible();
    await expect(page.locator(".screen-page--outgoing")).toHaveCount(0);

    const nodes = await page.locator("*").count();
    baselineNodes ??= nodes;
    expect(nodes).toBeLessThanOrEqual(baselineNodes + 8);
  }
});
