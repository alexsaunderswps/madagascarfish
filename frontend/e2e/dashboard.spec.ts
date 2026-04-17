import { expect, test } from "@playwright/test";

test("dashboard renders headline, coverage stat, chart, and updated-ago", async ({ page }) => {
  const resp = await page.goto("/dashboard/", {
    timeout: 60000,
    waitUntil: "domcontentloaded",
  });
  expect(resp?.status(), "preview should not 401 /dashboard").toBeLessThan(400);

  await expect(
    page.getByRole("heading", { level: 1, name: /Madagascar freshwater fish/i }),
  ).toBeVisible({ timeout: 30000 });

  const stat = page.getByTestId("coverage-gap-stat");
  await expect(stat).toBeVisible();
  expect(await stat.getAttribute("href")).toMatch(
    /^\/species\/?\?iucn_status=CR,EN,VU&has_captive_population=false$/,
  );

  await expect(page.getByRole("heading", { name: /Species by IUCN status/i })).toBeVisible();
  await expect(page.getByText(/Updated /)).toBeVisible();
});

test("IUCN chart bars are clickable deep-links to filtered directory", async ({ page }) => {
  await page.goto("/dashboard/", { timeout: 60000, waitUntil: "domcontentloaded" });

  // Expanded labels — "Endangered (EN)" etc.
  const enBar = page.getByRole("link", { name: /species with status Endangered/i });
  await expect(enBar).toBeVisible({ timeout: 30000 });
  expect(await enBar.getAttribute("href")).toBe("/species/?iucn_status=EN");

  const crBar = page.getByRole("link", { name: /species with status Critically Endangered/i });
  expect(await crBar.getAttribute("href")).toBe("/species/?iucn_status=CR");
});
