import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchCoverageGap,
  fetchSexRatioRisk,
  fetchStaleCensus,
  fetchStudbookStatus,
  fetchTransferActivity,
  isCoordinatorTokenConfigured,
} from "./coordinatorDashboard";

describe("coordinatorDashboard fetchers", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://api.test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it("sends Authorization: Bearer when token is set", async () => {
    process.env.COORDINATOR_API_TOKEN = "deadbeef";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ total_populations: 0, total_stale: 0, results: [] }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await fetchStaleCensus();

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer deadbeef");
  });

  it("omits the Authorization header when no token is set", async () => {
    delete process.env.COORDINATOR_API_TOKEN;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ total: 0, results: [] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await fetchCoverageGap();

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("appends endemic_only=false query when requested", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ total: 0, results: [] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await fetchCoverageGap({ endemicOnly: false });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/coverage-gap/?endemic_only=false");
  });

  it("returns null when the API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500 })),
    );
    expect(await fetchStudbookStatus()).toBeNull();
    expect(await fetchSexRatioRisk()).toBeNull();
  });

  it("fetchTransferActivity hits the correct path", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            window_days: 90,
            reference_date: "2026-04-22",
            in_flight_count: 0,
            recent_completed_count: 0,
            in_flight: [],
            recent_completed: [],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const body = await fetchTransferActivity();
    expect(body).toEqual({
      window_days: 90,
      reference_date: "2026-04-22",
      in_flight_count: 0,
      recent_completed_count: 0,
      in_flight: [],
      recent_completed: [],
    });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/coordinator-dashboard/transfer-activity/");
  });
});

describe("isCoordinatorTokenConfigured", () => {
  const ORIGINAL = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("is true when COORDINATOR_API_TOKEN is set", () => {
    process.env.COORDINATOR_API_TOKEN = "x";
    expect(isCoordinatorTokenConfigured()).toBe(true);
  });

  it("is false when unset", () => {
    delete process.env.COORDINATOR_API_TOKEN;
    expect(isCoordinatorTokenConfigured()).toBe(false);
  });

  it("is false when set to an empty string", () => {
    process.env.COORDINATOR_API_TOKEN = "";
    expect(isCoordinatorTokenConfigured()).toBe(false);
  });
});
