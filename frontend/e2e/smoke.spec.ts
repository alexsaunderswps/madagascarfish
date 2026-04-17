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

  const primarySections = page.getByRole("navigation", {
    name: /primary sections/i,
  });
  await expect(primarySections.getByRole("link")).toHaveCount(3);
});

test("coverage-gap stat links to pre-filtered directory", async ({ page }) => {
  await page.goto("/");

  const stat = page.getByTestId("coverage-gap-stat");
  await expect(stat).toBeVisible();
  const href = await stat.getAttribute("href");
  expect(href).toMatch(
    /^\/species\/?\?iucn_status=CR,EN,VU&has_captive_population=false$/,
  );
});

test("site header nav renders links in Dashboard → Map → Directory → About order", async ({
  page,
}) => {
  await page.goto("/");

  const primaryNav = page.getByRole("navigation", { name: "Primary" });
  const labels = await primaryNav.getByRole("link").allInnerTexts();
  expect(labels).toEqual(["Dashboard", "Map", "Species Directory", "About"]);
});

test("About page renders owner and GitHub link", async ({ page }) => {
  await page.goto("/about/");

  await expect(
    page.getByRole("heading", { level: 1, name: /^About$/ }),
  ).toBeVisible();
  await expect(page.getByText(/Aleksei Saunders/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /github\.com\/alexsaunderswps\/madagascarfish/i }),
  ).toBeVisible();
});

test("site footer is present on every page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText(/Apache-2\.0/);
});
