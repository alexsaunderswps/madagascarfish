import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchCoverageGap,
  fetchSexRatioRisk,
  fetchStaleCensus,
  fetchStudbookStatus,
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
});
