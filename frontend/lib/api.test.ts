import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "./api";

const ORIGINAL_API_URL = process.env.NEXT_PUBLIC_API_URL;

describe("apiFetch", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL_API_URL;
    vi.restoreAllMocks();
  });

  it("throws when NEXT_PUBLIC_API_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    await expect(apiFetch("/api/v1/health/")).rejects.toThrow(
      /NEXT_PUBLIC_API_URL/,
    );
  });

  it("throws ApiError with status + url on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 503 })),
    );

    try {
      await apiFetch("/api/v1/species/");
      expect.fail("apiFetch should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(503);
      expect(apiErr.url).toBe("http://localhost:8000/api/v1/species/");
    }
  });

  it("returns parsed JSON on 2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, count: 79 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const data = await apiFetch<{ ok: boolean; count: number }>(
      "/api/v1/species/",
    );
    expect(data).toEqual({ ok: true, count: 79 });
  });

  it("strips trailing slash on base url before concatenating path", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/";
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await apiFetch("/api/v1/health/");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/health/",
      expect.any(Object),
    );
  });

  // --- Gate 11: authToken branch ----------------------------------------

  function captureHeaders(fetchSpy: ReturnType<typeof vi.fn>): Headers {
    const args = fetchSpy.mock.calls[0];
    const init = args[1] as RequestInit;
    return new Headers(init.headers as HeadersInit);
  }

  it("does not set Authorization when authToken is undefined (back-compat)", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await apiFetch("/api/v1/species/");

    const args = fetchSpy.mock.calls[0];
    const init = args[1] as RequestInit | undefined;
    // Either init.headers is absent, or it has no Authorization key.
    if (init?.headers) {
      expect(new Headers(init.headers as HeadersInit).get("Authorization")).toBeNull();
    }
  });

  it("sets Authorization: Token <key> when authToken is provided", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await apiFetch("/api/v1/auth/me/", { authToken: "abc123" });

    expect(captureHeaders(fetchSpy).get("Authorization")).toBe("Token abc123");
  });

  it("explicit Authorization in headers wins over authToken (service-token escape hatch)", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await apiFetch("/api/v1/coordinator-dashboard/coverage-gap/", {
      authToken: "user-drf-token",
      headers: { Authorization: "Bearer service-token-value" },
    });

    expect(captureHeaders(fetchSpy).get("Authorization")).toBe(
      "Bearer service-token-value",
    );
  });
});
