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
});
