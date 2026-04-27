import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TIER_REFRESH_TTL_SECONDS, refreshTierIfStale } from "./auth";

const ORIGINAL_API_URL = process.env.NEXT_PUBLIC_API_URL;

describe("refreshTierIfStale", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://api.test";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL_API_URL;
    vi.restoreAllMocks();
  });

  function freshToken(): {
    tier: number;
    drfToken: string;
    tierFetchedAt: number;
  } {
    // Fetched-at = now; the helper should NOT issue a fetch.
    return { tier: 3, drfToken: "abc123", tierFetchedAt: Date.now() };
  }

  function staleToken(): {
    tier: number;
    drfToken: string;
    tierFetchedAt: number;
  } {
    // Older than the 5-minute TTL — must trigger /me/.
    return {
      tier: 3,
      drfToken: "abc123",
      tierFetchedAt: Date.now() - (TIER_REFRESH_TTL_SECONDS + 30) * 1000,
    };
  }

  it("returns token unchanged and issues no fetch when fresh", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    const token = freshToken();
    const result = await refreshTierIfStale(token);
    expect(result).toEqual(token);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns token unchanged when no drfToken is present (anonymous)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    const result = await refreshTierIfStale({});
    expect(result).toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("updates tier and tierFetchedAt on a 200 from /me/", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ email: "x@y", name: "X", access_tier: 4 }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const before = staleToken();
    const beforeAt = before.tierFetchedAt;
    const result = await refreshTierIfStale(before);
    expect(result.tier).toBe(4);
    expect(result.tierFetchedAt).toBeGreaterThan(beforeAt);
  });

  it("returns {} on 401 — forces /login on the next request", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchSpy);
    const result = await refreshTierIfStale(staleToken());
    expect(result).toEqual({});
  });

  it("returns token unchanged on 5xx (transient Django blip)", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("boom", { status: 503 }));
    vi.stubGlobal("fetch", fetchSpy);
    const before = staleToken();
    const result = await refreshTierIfStale(before);
    expect(result.tier).toBe(3);
    expect(result.drfToken).toBe("abc123");
  });

  it("returns token unchanged on network error", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    vi.stubGlobal("fetch", fetchSpy);
    const before = staleToken();
    const result = await refreshTierIfStale(before);
    expect(result.tier).toBe(3);
    expect(result.drfToken).toBe("abc123");
  });

  it("sends Authorization: Token <key> when calling /me/", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ email: "x", name: "X", access_tier: 2 }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await refreshTierIfStale(staleToken());
    const args = fetchSpy.mock.calls[0];
    const init = args[1] as RequestInit;
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Token abc123");
  });
});
