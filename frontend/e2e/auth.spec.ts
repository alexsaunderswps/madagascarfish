import { expect, test } from "@playwright/test";

/**
 * Gate 11 auth e2e — full signup → verify → login → /account loop.
 *
 * Runs against a local stack: Django on E2E_BACKEND_URL (default
 * http://localhost:8000) and Next.js on PLAYWRIGHT_BASE_URL (default
 * http://localhost:3000), with `NEXT_PUBLIC_FEATURE_AUTH=true` so
 * middleware + nav are active.
 *
 * The test bypasses the real email vendor by hitting the test-only
 * `/api/v1/auth/_test/verification-token/` endpoint, gated server-side
 * by `ALLOW_TEST_HELPERS` (returns 404 in prod). See
 * `docs/planning/specs/gate-11-auth-mvp.md` §C9 and the CI workflow at
 * `.github/workflows/frontend-auth-e2e.yml`.
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:8000";
const E2E_PASSWORD = "long-strong-e2e-pw-9876";

async function fetchVerificationToken(email: string): Promise<string> {
  const url = `${BACKEND_URL}/api/v1/auth/_test/verification-token/?email=${encodeURIComponent(email)}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(
      `verification-token fetch failed: ${response.status} ${response.statusText}`,
    );
  }
  const body = (await response.json()) as { token: string };
  return body.token;
}

test.describe("Gate 11 auth flow", () => {
  test("signup → verify → login → /account renders Tier 2 badge", async ({ page }) => {
    // Unique email per run — each test creates a fresh account.
    const uniqueEmail = `e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;

    // --- /signup ---
    await page.goto("/signup");
    await expect(page.getByRole("heading", { level: 1, name: /create an account/i })).toBeVisible();
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Name").fill("E2E Researcher");
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /create account/i }).click();

    // "Check your email" interstitial — same copy whether the email was new
    // or duplicate (enumeration resistance).
    await expect(page.getByRole("status").getByText(/check your email/i)).toBeVisible();

    // --- /verify ---
    const token = await fetchVerificationToken(uniqueEmail);
    const verifyResponse = await page.goto(
      `/verify?token=${encodeURIComponent(token)}`,
    );
    // Should redirect to /login?verified=1.
    expect(page.url()).toMatch(/\/login\?verified=1$/);
    expect(verifyResponse?.status()).toBeLessThan(400);
    await expect(
      page.getByRole("status").getByText(/account verified/i),
    ).toBeVisible();

    // --- /login ---
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // Land somewhere on the same origin (default callbackUrl is /).
    await page.waitForURL((url) => url.pathname === "/", { timeout: 15000 });

    // --- /account ---
    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 1, name: /your profile/i })).toBeVisible();
    await expect(page.getByText("E2E Researcher")).toBeVisible();
    await expect(page.getByText(uniqueEmail)).toBeVisible();
    await expect(page.getByText(/researcher · tier 2/i)).toBeVisible();
  });

  test("anonymous /account redirects to /login with callbackUrl preserved", async ({ page }) => {
    const response = await page.goto("/account");
    expect(page.url()).toMatch(/\/login\?callbackUrl=%2Faccount$|\/login\?callbackUrl=\/account$/);
    expect(response?.status()).toBeLessThan(400);
  });

  test("seeded Tier 3 coordinator can sign in and reach the coordinator dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("coordinator-e2e@example.com");
    await page.getByLabel("Password").fill("e2e-test-password-1234");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 15000 });

    // The coordinator dashboard route doesn't redirect for an authenticated
    // session — middleware lets it through, SSR runs, the API decides tier.
    const response = await page.goto("/dashboard/coordinator");
    expect(response?.status()).toBeLessThan(400);
    expect(page.url()).not.toMatch(/\/login/);
  });
});
