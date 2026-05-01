import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

import { middleware } from "./middleware";

const getTokenMock = vi.mocked(getToken);

const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_FEATURE_AUTH;
const ORIGINAL_SECRET = process.env.NEXTAUTH_SECRET;
const ORIGINAL_COORD_TOKEN = process.env.COORDINATOR_API_TOKEN;

function req(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${path}`));
}

/**
 * Composed middleware (next-intl + auth gate). For let-through, the
 * response carries either `x-middleware-next: 1` (no rewrite needed) or
 * `x-middleware-rewrite` (next-intl rewrote `/path` → `/<locale>/path`
 * for App Router matching). Either is a valid pass-through; tests
 * accept both.
 */
function isPassThrough(res: Response): boolean {
  return (
    res.headers.get("x-middleware-next") === "1" ||
    res.headers.get("x-middleware-rewrite") !== null
  );
}

describe("middleware /dashboard/coordinator gate (default locale)", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    getTokenMock.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = ORIGINAL_FLAG;
    process.env.NEXTAUTH_SECRET = ORIGINAL_SECRET;
    process.env.COORDINATOR_API_TOKEN = ORIGINAL_COORD_TOKEN;
  });

  it("redirects anonymous to / when auth UX flag is off (login is hidden)", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "false";
    getTokenMock.mockResolvedValue(null);
    const res = await middleware(req("/dashboard/coordinator/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects anonymous to /login?callbackUrl=… when auth UX flag is on", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "true";
    getTokenMock.mockResolvedValue(null);
    const res = await middleware(req("/dashboard/coordinator/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Fdashboard%2Fcoordinator%2F",
    );
  });

  it("redirects Tier 1 users (authenticated, public-tier) home when flag is off", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "false";
    getTokenMock.mockResolvedValue({ tier: 1 });
    const res = await middleware(req("/dashboard/coordinator/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects Tier 2 users (researcher) to login when flag is on", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "true";
    getTokenMock.mockResolvedValue({ tier: 2 });
    const res = await middleware(req("/dashboard/coordinator/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Fdashboard%2Fcoordinator%2F",
    );
  });

  it("lets Tier 3 users through", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "true";
    getTokenMock.mockResolvedValue({ tier: 3 });
    const res = await middleware(req("/dashboard/coordinator/"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("ignores COORDINATOR_API_TOKEN — service token must not bypass middleware", async () => {
    // Regression: previously, presence of COORDINATOR_API_TOKEN env let
    // anonymous browsers reach the dashboard. Service token is a
    // server-to-server fallback inside SSR fetchers, never a route bypass.
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "true";
    process.env.COORDINATOR_API_TOKEN = "definitely-set";
    getTokenMock.mockResolvedValue(null);
    const res = await middleware(req("/dashboard/coordinator/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Fdashboard%2Fcoordinator%2F",
    );
  });
});

describe("middleware /dashboard/institution gate (default locale)", () => {
  // Gate 13. Tier 2+ AND token present, but the page-level claim_status
  // check is server-side (not visible to middleware), so middleware lets
  // any authenticated Tier 2+ through and the page redirects to /account
  // if the claim isn't approved.
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    getTokenMock.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = ORIGINAL_FLAG;
  });

  it("redirects anonymous to / when auth flag is off", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "false";
    getTokenMock.mockResolvedValue(null);
    const res = await middleware(req("/dashboard/institution/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects anonymous to /login when flag is on", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "true";
    getTokenMock.mockResolvedValue(null);
    const res = await middleware(req("/dashboard/institution/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Fdashboard%2Finstitution%2F",
    );
  });

  it("redirects Tier 1 users to /login when flag is on", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "true";
    getTokenMock.mockResolvedValue({ tier: 1 });
    const res = await middleware(req("/dashboard/institution/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Fdashboard%2Finstitution%2F",
    );
  });

  it("lets Tier 2 users through (page-level checks claim_status)", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "true";
    getTokenMock.mockResolvedValue({ tier: 2 });
    const res = await middleware(req("/dashboard/institution/"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("lets Tier 3 users through", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "true";
    getTokenMock.mockResolvedValue({ tier: 3 });
    const res = await middleware(req("/dashboard/institution/"));
    expect(isPassThrough(res)).toBe(true);
  });
});

describe("middleware /account gate (default locale)", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    getTokenMock.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = ORIGINAL_FLAG;
  });

  it("passes through when auth UX flag is off (route not surfaced)", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "false";
    getTokenMock.mockResolvedValue(null);
    const res = await middleware(req("/account"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("redirects anonymous to /login when flag is on", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "true";
    getTokenMock.mockResolvedValue(null);
    const res = await middleware(req("/account"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Faccount",
    );
  });

  it("lets authenticated users through regardless of tier", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "true";
    getTokenMock.mockResolvedValue({ tier: 1 });
    const res = await middleware(req("/account"));
    expect(isPassThrough(res)).toBe(true);
  });
});

// A3 — Architect doc §9 R1. Composed-middleware × locale prefix
// regression suite. Auth gate must catch protected routes under every
// supported locale and must construct locale-aware redirect URLs so the
// user lands on /<locale>/login (not /login) when their browse
// language is non-default.
describe("middleware /account gate (locale-prefixed)", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "true";
    getTokenMock.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = ORIGINAL_FLAG;
  });

  it("/fr/account anonymous → /fr/login?callbackUrl=/fr/account", async () => {
    getTokenMock.mockResolvedValue(null);
    const res = await middleware(req("/fr/account"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/fr/login?callbackUrl=%2Ffr%2Faccount",
    );
  });

  it("/de/account anonymous → /de/login?callbackUrl=/de/account", async () => {
    getTokenMock.mockResolvedValue(null);
    const res = await middleware(req("/de/account"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/de/login?callbackUrl=%2Fde%2Faccount",
    );
  });

  it("/es/account Tier 1 → through (account is tier-agnostic)", async () => {
    getTokenMock.mockResolvedValue({ tier: 1 });
    const res = await middleware(req("/es/account"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("/fr/account with auth flag off passes through (route not gated)", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "false";
    getTokenMock.mockResolvedValue(null);
    const res = await middleware(req("/fr/account"));
    expect(isPassThrough(res)).toBe(true);
  });
});

describe("middleware /dashboard/coordinator gate (locale-prefixed)", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "true";
    getTokenMock.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = ORIGINAL_FLAG;
  });

  it("/de/dashboard/coordinator Tier 2 → /de/login?callbackUrl=/de/dashboard/coordinator", async () => {
    getTokenMock.mockResolvedValue({ tier: 2 });
    const res = await middleware(req("/de/dashboard/coordinator"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/de/login?callbackUrl=%2Fde%2Fdashboard%2Fcoordinator",
    );
  });

  it("/fr/dashboard/coordinator Tier 3 → through", async () => {
    getTokenMock.mockResolvedValue({ tier: 3 });
    const res = await middleware(req("/fr/dashboard/coordinator"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("/es/dashboard/coordinator anonymous, flag off → /es (locale-aware home)", async () => {
    process.env.NEXT_PUBLIC_FEATURE_AUTH = "false";
    getTokenMock.mockResolvedValue(null);
    const res = await middleware(req("/es/dashboard/coordinator"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/es");
  });

  it("/fr/dashboard/coordinator Tier 1 → /fr/login (locale-aware login redirect)", async () => {
    getTokenMock.mockResolvedValue({ tier: 1 });
    const res = await middleware(req("/fr/dashboard/coordinator"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/fr/login?callbackUrl=%2Ffr%2Fdashboard%2Fcoordinator",
    );
  });
});
