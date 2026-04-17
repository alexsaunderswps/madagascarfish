import { expect, test } from "@playwright/test";

test("hero landing renders mission, coverage stat, and three nav cards", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Coordinating conservation/i,
    }),
  ).toBeVisible();

  await expect(page.getByTestId("coverage-gap-stat")).toBeVisible();

  const navLinks = page.getByRole("navigation", { name: /primary sections/i });
  await expect(navLinks.getByRole("link")).toHaveCount(3);
  await expect(navLinks.getByRole("heading", { name: /Species Directory/i })).toBeVisible();
  await expect(navLinks.getByRole("heading", { name: /Distribution Map/i })).toBeVisible();
  await expect(navLinks.getByRole("heading", { name: /Conservation Dashboard/i })).toBeVisible();
});

test("coverage-gap stat links to pre-filtered directory", async ({ page }) => {
  await page.goto("/");

  const stat = page.getByTestId("coverage-gap-stat");
  await expect(stat).toBeVisible();
  const href = await stat.getAttribute("href");
  expect(href).toBe(
    "/species/?iucn_status=CR,EN,VU&has_captive_population=false",
  );
});
