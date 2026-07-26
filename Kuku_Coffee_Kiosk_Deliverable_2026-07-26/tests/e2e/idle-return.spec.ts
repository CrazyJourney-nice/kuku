import { expect, test } from "@playwright/test";

test("default idle policy waits 90 seconds before the 10-second return", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("screen-impact")).toBeVisible();
  await expect(page.getByTestId("start-order-direct")).toBeEnabled();
  await page.getByTestId("start-order-direct").click();
  await expect(page.getByTestId("screen-drink")).toBeVisible();

  await page.clock.install({ time: new Date() });
  await page.clock.fastForward(89_000);
  await expect(page.getByTestId("idle-return-dialog")).toHaveCount(0);

  await page.clock.fastForward(1_250);
  const idleDialog = page.getByTestId("idle-return-dialog");
  await expect(idleDialog).toBeVisible();
  await expect(idleDialog.getByText("即将回到首页")).toBeVisible();
  await expect(idleDialog.getByText("10", { exact: true })).toBeVisible();

  await page.clock.fastForward(10_000);
  await expect(page.getByTestId("screen-impact")).toBeVisible();
  await expect(idleDialog).toHaveCount(0);
});

test("welcome screen follows the same unified idle return policy", async ({
  page,
}) => {
  await page.goto("/?visual=1&idleTest=1");
  await expect(page.getByTestId("start-order-direct")).toBeEnabled();
  await page.getByTestId("start-order-direct").click();
  await expect(page.getByTestId("screen-welcome")).toBeVisible();

  await expect(page.getByTestId("idle-return-dialog")).toBeVisible({
    timeout: 3_500,
  });
  await expect(page.getByTestId("screen-impact")).toBeVisible({
    timeout: 4_500,
  });
});

test("local idle test warns, counts down, and returns to the impact screen", async ({
  page,
}) => {
  await page.goto("/?idleTest=1");
  await expect(page.getByTestId("screen-impact")).toBeVisible();
  await expect(page.locator("main.kiosk-app")).toHaveAttribute(
    "data-idle-test",
    "true",
  );
  await expect(page.getByTestId("start-order-direct")).toBeEnabled();

  await page.getByTestId("start-order-direct").click();
  await expect(page.getByTestId("screen-drink")).toBeVisible();
  await expect(page.getByTestId("idle-return-dialog")).toBeVisible({
    timeout: 3_500,
  });
  const idleDialog = page.getByTestId("idle-return-dialog");
  await expect(idleDialog.getByText("即将回到首页")).toBeVisible();
  await expect(idleDialog.getByText("3", { exact: true })).toBeVisible();

  await expect(page.getByTestId("screen-impact")).toBeVisible({
    timeout: 4_500,
  });
  await expect(page.getByTestId("idle-return-dialog")).toHaveCount(0);
  await expect(page.locator("main.kiosk-app")).toHaveAttribute(
    "data-mascot-sleeping",
    "true",
    { timeout: 6_500 },
  );
});
