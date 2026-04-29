import { expect, test } from "@playwright/test";

/**
 * Gate L1 i18n smoke tests (Wave 4 / S11).
 *
 * Covers the L1 spec's acceptance criteria for the framework gate:
 *   - Every key page loads under every supported locale (en/fr/de/es).
 *   - <html lang="..."> matches the URL locale prefix.
 *   - hreflang link tags are emitted for all four locales + x-default.
 *   - Locale switcher is present in the header (under flag on).
 *   - Non-English locales render English fallback content (correct for
 *     L1 — no translations have shipped yet).
 *
 * Plus the architect's A4 addition: locale-aware caching contamination
 * test. Two back-to-back fetches with different Accept-Language headers
 * each render the expected locale, proving Vercel's cache key includes
 * the locale and a French response can't leak into an English visitor's
 * render.
 *
 * Requires NEXT_PUBLIC_FEATURE_I18N=true in the environment under test.
 * Local dev's .env.local sets this; CI / Vercel preview must opt in.
 */

const LOCALES = ["en", "fr", "de", "es"] as const;
type Locale = (typeof LOCALES)[number];

// Page set covers each routing shape: home, listing, detail, dynamic,
// long-form. Not every page on the site — five representative ones the
// architect's spec called out.
const KEY_PAGES = [
  { path: "/", description: "home" },
  { path: "/species", description: "species directory" },
  { path: "/map", description: "map" },
  { path: "/about", description: "about page" },
  { path: "/about/glossary", description: "glossary" },
] as const;

function localizedPath(locale: Locale, path: string): string {
  if (locale === "en") return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

test.describe("i18n smoke — every locale loads every key page", () => {
  for (const locale of LOCALES) {
    for (const { path, description } of KEY_PAGES) {
      const url = localizedPath(locale, path);
      test(`[${locale}] ${description} (${url}) renders`, async ({ page }) => {
        const response = await page.goto(url, {
          timeout: 60000,
          waitUntil: "domcontentloaded",
        });
        expect(response?.status(), `${url} should not 5xx`).toBeLessThan(500);
        // Pages should resolve cleanly (200 or 308 trailing-slash redirect
        // chain). 4xx indicates a routing bug.
        expect(response?.status(), `${url} should not 4xx`).toBeLessThan(400);
      });
    }
  }
});

test.describe("i18n metadata — <html lang> matches URL prefix", () => {
  for (const locale of LOCALES) {
    test(`[${locale}] <html lang="${locale}"> on home`, async ({ page }) => {
      await page.goto(localizedPath(locale, "/"), {
        timeout: 60000,
        waitUntil: "domcontentloaded",
      });
      const lang = await page.locator("html").getAttribute("lang");
      expect(lang).toBe(locale);
    });
  }
});

test.describe("i18n metadata — hreflang Link headers cover all four locales + x-default", () => {
  // The <link rel="alternate" hreflang="..."> tags are rendered into
  // the HTML head (not just the Link HTTP header). Hit /species/ on
  // each locale and assert the alternates are present.
  for (const locale of LOCALES) {
    test(`[${locale}] /species emits hreflang for en/fr/de/es + x-default`, async ({
      page,
    }) => {
      await page.goto(localizedPath(locale, "/species"), {
        timeout: 60000,
        waitUntil: "domcontentloaded",
      });
      // Five expected hreflang values: en, fr, de, es, x-default.
      for (const tag of ["en", "fr", "de", "es", "x-default"]) {
        const link = page.locator(`head link[rel="alternate"][hreflang="${tag}"]`);
        await expect(
          link,
          `expected hreflang="${tag}" link in head on ${locale} /species`,
        ).toHaveCount(1);
      }
    });
  }
});

test.describe("i18n switcher — present on every page when flag on", () => {
  for (const locale of LOCALES) {
    test(`[${locale}] LocaleSwitcher is in the header`, async ({ page }) => {
      await page.goto(localizedPath(locale, "/"), {
        timeout: 60000,
        waitUntil: "domcontentloaded",
      });
      // The switcher renders as a <select aria-label="Language" />
      // (LocaleSwitcher.tsx). When flag is off it returns null and the
      // assertion fails — a useful signal that the test environment
      // doesn't have NEXT_PUBLIC_FEATURE_I18N=true.
      const switcher = page.getByLabel("Language");
      await expect(
        switcher,
        `expected LocaleSwitcher; if missing, set NEXT_PUBLIC_FEATURE_I18N=true in the test env`,
      ).toBeVisible({ timeout: 10000 });
      // Selected option matches the current locale.
      await expect(switcher).toHaveValue(locale);
    });
  }
});

test.describe("i18n fallback — non-English locales render English content (L1)", () => {
  // L1 ships with byte-identical English placeholders in fr/de/es
  // catalogs. Until L2 translates the UI, /fr/ etc. render English.
  // This test confirms that's the current state — when L2 ships, the
  // assertion will need updating.
  for (const locale of LOCALES.filter((l) => l !== "en")) {
    test(`[${locale}] home page renders the English hero (placeholder)`, async ({
      page,
    }) => {
      await page.goto(localizedPath(locale, "/"), {
        timeout: 60000,
        waitUntil: "domcontentloaded",
      });
      // Home hero copy: "A shared record for Madagascar's endemic
      // freshwater fish."
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /shared record for Madagascar/i,
        }),
      ).toBeVisible({ timeout: 30000 });
    });
  }
});

test.describe("i18n cache contamination (architect A4)", () => {
  // Two back-to-back HTTP fetches with different Accept-Language headers.
  // Each must render the locale that matches its URL — a French URL
  // never renders English from a previously-cached English request, and
  // vice versa. This catches Vercel cache-key misconfiguration where the
  // locale isn't part of the cache key.
  //
  // The check is on the <html lang="..."> attribute specifically, not
  // any "lang" substring — hreflang link tags also contain `lang="fr"`
  // as a substring, so the assertion uses a regex that anchors to the
  // <html> opening tag.
  //
  // Each request runs in its own playwright.request.newContext() so the
  // NEXT_LOCALE cookie set by next-intl middleware doesn't leak between
  // them. Cookie-driven locale routing is correct behavior; this test
  // is specifically about the *cache* key, not the cookie.
  const HTML_LANG_RE = (locale: string) =>
    new RegExp(`<html[^>]*\\blang="${locale}"`);

  test("back-to-back en then fr requests each render the expected locale", async ({
    playwright,
  }) => {
    const enCtx = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
    });
    const enResponse = await enCtx.get("/", {
      headers: { "Accept-Language": "en" },
    });
    expect(enResponse.status()).toBe(200);
    const enBody = await enResponse.text();
    expect(enBody, "en request should return <html lang=en>").toMatch(
      HTML_LANG_RE("en"),
    );
    await enCtx.dispose();

    const frCtx = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
    });
    const frResponse = await frCtx.get("/fr", {
      headers: { "Accept-Language": "fr" },
    });
    expect(frResponse.status()).toBe(200);
    const frBody = await frResponse.text();
    expect(frBody, "fr request should return <html lang=fr>").toMatch(
      HTML_LANG_RE("fr"),
    );
    expect(
      frBody,
      "fr request should NOT carry <html lang=en> from cache",
    ).not.toMatch(HTML_LANG_RE("en"));
    await frCtx.dispose();
  });

  test("back-to-back fr then en requests each render the expected locale", async ({
    playwright,
  }) => {
    const frCtx = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
    });
    const frResponse = await frCtx.get("/fr", {
      headers: { "Accept-Language": "fr" },
    });
    expect(frResponse.status()).toBe(200);
    expect(await frResponse.text()).toMatch(HTML_LANG_RE("fr"));
    await frCtx.dispose();

    const enCtx = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
    });
    const enResponse = await enCtx.get("/", {
      headers: { "Accept-Language": "en" },
    });
    expect(enResponse.status()).toBe(200);
    const enBody = await enResponse.text();
    expect(enBody).toMatch(HTML_LANG_RE("en"));
    expect(
      enBody,
      "en request should NOT carry <html lang=fr> from cache",
    ).not.toMatch(HTML_LANG_RE("fr"));
    await enCtx.dispose();
  });
});

test.describe("i18n switcher round-trip", () => {
  // The dropdown's onChange handler runs only after React hydration
  // completes — in dev that can be 1–2s after domcontentloaded.
  // Wait for the page to be fully loaded before interacting.
  test("switching from English to Français and back via the dropdown", async ({
    page,
  }) => {
    // 1. Land on English home, wait for hydration to complete.
    await page.goto("/", { timeout: 60000, waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // 2. Pick Français in the switcher. selectOption fires the
    // onChange handler which calls router.replace inside a transition.
    const switcher = page.getByLabel("Language");
    await switcher.selectOption("fr");

    // 3. <html lang> flips to fr (proves the locale switch landed).
    // Generous timeout: dev mode + transition + navigation can take
    // several seconds.
    await expect(page.locator("html")).toHaveAttribute("lang", "fr", {
      timeout: 60000,
    });
    expect(page.url()).toMatch(/\/fr\/?$/);

    // 4. Switch back to English.
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Language").selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en", {
      timeout: 60000,
    });
    // English is the default locale (localePrefix: "as-needed"), so
    // the URL should drop the prefix entirely.
    expect(page.url()).toMatch(/localhost:3000\/?$/);
  });
});
