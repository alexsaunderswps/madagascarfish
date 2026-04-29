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

describe("middleware /dashboard/coordinator gate", () => {
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
    // NextResponse.next() returns a response with x-middleware-next header.
    expect(res.headers.get("x-middleware-next")).toBe("1");
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

describe("middleware /account gate", () => {
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
    expect(res.headers.get("x-middleware-next")).toBe("1");
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
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
