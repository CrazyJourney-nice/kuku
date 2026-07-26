import { expect, test, type Page } from "@playwright/test";

async function expectCurrentScreen(
  page: Page,
  screen: string,
  direction: "forward" | "backward",
) {
  const visibleScreen = page.getByTestId(`screen-${screen}`);
  await expect(visibleScreen).toBeVisible();
  await expect(page.locator(".kiosk-app")).toHaveAttribute("data-screen", screen);
  await expect(page.locator(".screen-deck")).toHaveAttribute(
    "data-current-screen",
    screen,
  );
  await expect(page.locator(".screen-page")).toHaveCount(1);
  await expect(page.locator("[data-testid^='screen-']")).toHaveCount(1);
  await expect(visibleScreen).toHaveAttribute("data-direction", direction);
  await expect(visibleScreen).toHaveCSS(
    "animation-name",
    direction === "forward" ? "screen-forward" : "screen-backward",
  );
  await expect(visibleScreen).toHaveCSS("will-change", "transform, opacity");
}

test("next screens enter from the right and previous screens enter from the left", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("screen-impact")).toBeVisible();
  await expect(page.getByTestId("start-order-direct")).toBeEnabled();

  // A burst must advance exactly one screen, never skip visible content.
  await page.getByTestId("start-order-direct").evaluate((button) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      (button as HTMLButtonElement).click();
    }
  });
  await expectCurrentScreen(page, "drink", "forward");

  await page.getByTestId("drink-latte").click();
  await expect(page.getByTestId("continue-customize")).toBeEnabled();
  await page.getByTestId("continue-customize").click();
  await expectCurrentScreen(page, "customize", "forward");
  await expect(page.getByText("当前饮品拿铁")).toBeVisible();

  await expect(page.getByTestId("continue-confirm")).toBeEnabled();
  await page.getByTestId("continue-confirm").click();
  await expectCurrentScreen(page, "confirm", "forward");
  await expect(page.getByTestId("order-summary")).toContainText("拿铁");

  await expect(
    page.getByRole("button", { name: "修改定制", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "修改定制", exact: true })
    .click();
  await expectCurrentScreen(page, "customize", "backward");
  await expect(page.getByText("当前饮品拿铁")).toBeVisible();

  await expect(
    page.getByRole("button", { name: "返回饮品", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "返回饮品", exact: true })
    .click();
  await expectCurrentScreen(page, "drink", "backward");
  await expect(page.getByTestId("drink-latte").locator("input")).toBeChecked();
});
