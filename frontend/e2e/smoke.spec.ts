import { expect, test } from "@playwright/test";

test("hero page renders the platform heading", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Madagascar Freshwater Fish Conservation Platform/i,
    }),
  ).toBeVisible();
});
