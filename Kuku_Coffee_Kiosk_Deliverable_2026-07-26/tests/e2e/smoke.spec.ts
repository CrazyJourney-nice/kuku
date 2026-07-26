import { expect, test, type Page } from "@playwright/test";

async function advanceToDrink(page: Page) {
  await page.getByTestId("start-intro").click();
  await expect(page.getByTestId("screen-welcome")).toBeVisible();
  await expect(page.getByTestId("start-order")).toBeEnabled();
  await page.getByTestId("start-order").click();
  await expect(page.getByTestId("screen-drink")).toBeVisible();
}

test("runs the complete kiosk flow and keeps the selected order consistent", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page.getByTestId("screen-impact")).toBeVisible();

  await advanceToDrink(page);
  await expect(page.getByTestId("continue-customize")).toBeDisabled();
  await page.getByTestId("drink-latte").click();
  await expect(page.getByTestId("continue-customize")).toBeEnabled();
  await page.getByTestId("continue-customize").click();

  await expect(page.getByTestId("screen-customize")).toBeVisible();
  await page.getByRole("radio", { name: "30%", exact: true }).check();
  await page.getByRole("radio", { name: "冰", exact: true }).check();
  await page.getByRole("radio", { name: "燕麦奶", exact: true }).check();
  await page.getByRole("radio", { name: "♥ 爱心", exact: true }).check();
  await expect(page.getByTestId("customization-summary")).toContainText(
    "甜度 30% · 冰 · 燕麦奶 · 爱心",
  );

  await expect(page.getByTestId("continue-confirm")).toBeEnabled();
  await page.getByTestId("continue-confirm").click();
  const summary = page.getByTestId("order-summary");
  await expect(summary).toContainText("拿铁");
  await expect(summary).toContainText("¥18");
  await expect(summary).toContainText("甜度 30%");
  await expect(summary).toContainText("燕麦奶");
  await expect(summary).toContainText("爱心");

  await expect(page.getByTestId("submit-order")).toBeEnabled();
  await page.getByTestId("submit-order").dblclick();
  await expect(page.getByTestId("screen-brewing")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "咖啡制作进度" }))
    .toHaveAttribute("aria-valuenow", /^(0|20|55|86|100)$/);

  await expect(page.getByTestId("screen-pickup")).toBeVisible({
    timeout: 8_000,
  });
  await expect(page.getByTestId("screen-pickup")).toContainText("拿铁");
  await page.getByTestId("finish-session").click();
  await expect(page.getByTestId("screen-impact")).toBeVisible();
});

test("shows a confirmation before clearing an unsubmitted selection", async ({
  page,
}) => {
  await page.goto("/");
  await advanceToDrink(page);
  await page.getByTestId("drink-americano").click();
  await page.getByRole("button", { name: "返回首页", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("返回首页并清空选择");
  await page.getByRole("button", { name: "继续选择", exact: true }).click();
  await expect(page.getByTestId("screen-drink")).toBeVisible();
});

test("has no document-level horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
});

test("exposes the drink guidance and a visible keyboard focus ring", async ({
  page,
}) => {
  await page.goto("/");
  await advanceToDrink(page);

  const nextButton = page.getByTestId("continue-customize");
  const hint = page.locator("#drink-next-hint");
  await expect(nextButton).toHaveAttribute("aria-describedby", "drink-next-hint");
  await expect(hint).toHaveCount(1);
  await expect(hint).toBeVisible();

  const firstDrink = page.getByRole("radio", { name: /美式/ });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await firstDrink.evaluate((element) => element === document.activeElement)) {
      break;
    }
    await page.keyboard.press("Tab");
  }
  await expect(firstDrink).toBeFocused();
  await expect(page.getByTestId("drink-americano")).toHaveCSS(
    "outline-style",
    "solid",
  );
});
