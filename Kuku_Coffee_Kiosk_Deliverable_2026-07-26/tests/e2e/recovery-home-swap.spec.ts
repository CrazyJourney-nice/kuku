import { expect, test } from "@playwright/test";

test("an in-flight recovery snapshot survives the initial impact home render", async ({
  page,
}) => {
  const savedAt = new Date().toISOString();
  const snapshot = {
    schemaVersion: 1,
    savedAt,
    clientOrderId: "recovery-home-swap",
    machineOrderId: "machine-recovery-home-swap",
    submittedOrder: {
      drinkId: "latte",
      drinkName: "拿铁",
      tagline: "柔和顺滑",
      unitPriceCents: 1800,
      quantity: 1,
      totalPriceCents: 1800,
      customization: {
        sweetness: 30,
        temperature: "hot",
        milkBase: "dairy",
        latteArt: "heart",
      },
    },
    lastKnownStatus: {
      machineOrderId: "machine-recovery-home-swap",
      clientOrderId: "recovery-home-swap",
      stage: "extracting",
      progress: 55,
      updatedAt: savedAt,
      recoverable: true,
    },
  };

  await page.addInitScript((value) => {
    window.localStorage.setItem("kuku.recovery.v1", JSON.stringify(value));
  }, snapshot);

  await page.goto("/");
  await expect(page.getByTestId("screen-recovering")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem("kuku.recovery.v1")),
    )
    .not.toBeNull();

  await page.reload();
  await expect(page.getByTestId("screen-recovering")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem("kuku.recovery.v1")),
    )
    .not.toBeNull();
});
