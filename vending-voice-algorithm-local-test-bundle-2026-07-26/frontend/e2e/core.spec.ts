import { expect, test } from "@playwright/test";

test("renders the linked camera-and-Rive-mascot surface", async ({ page }) => {
  await page.goto("/?fixture=1");

  await expect(page.getByText("UI TEST MODE")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Face tracking is live." })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Animated mascot eyes and body" }),
  ).toBeVisible();
  await expect(
    page.getByText("Live camera · face-linked mascot animation · two-stage local voice"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Following face T17" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable sound" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close demo" })).toBeVisible();
  await expect(page.getByRole("button", { name: /replay/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /preflight/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /configuration/i })).toHaveCount(0);
  await expect(page.getByTestId("frame-alignment")).toContainText(
    "visual target 17; attention target 17",
  );
});
