import { expect, test } from "@playwright/test";

test("map page renders Leaflet container and summary counts", async ({ page }) => {
  const resp = await page.goto("/map/", { timeout: 60000, waitUntil: "domcontentloaded" });
  expect(resp?.status(), "preview should not 401 /map").toBeLessThan(400);

  // Leaflet container mounts client-side after dynamic import.
  await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 30000 });

  // sr-only summary proves initialData made it into the client component.
  const summary = page.getByTestId("map-summary");
  await expect(summary).toHaveText(/\d+ locality records across \d+ species\./, {
    timeout: 30000,
  });
});

test("map legend is present and lists IUCN statuses", async ({ page }) => {
  await page.goto("/map/", { timeout: 60000, waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: /IUCN status/i })).toBeVisible({
    timeout: 30000,
  });
  for (const code of ["CR", "EN", "VU", "LC"]) {
    await expect(
      page.getByRole("link", { name: new RegExp(`^${code} `) }).first(),
    ).toBeVisible();
  }
});
