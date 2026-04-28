import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { djangoLogoutAction } from "./actions";

const ORIGINAL_API_URL = process.env.NEXT_PUBLIC_API_URL;

vi.mock("@/lib/auth", () => ({
  getServerDrfToken: vi.fn(),
}));

import { getServerDrfToken } from "@/lib/auth";

const mockedGetServerDrfToken = vi.mocked(getServerDrfToken);

describe("djangoLogoutAction", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL_API_URL;
    vi.restoreAllMocks();
    mockedGetServerDrfToken.mockReset();
  });

  it("returns ok without calling the network when no DRF token is available", async () => {
    mockedGetServerDrfToken.mockResolvedValue(undefined);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await djangoLogoutAction();

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to /api/v1/auth/logout/ with the DRF token in the Authorization header", async () => {
    mockedGetServerDrfToken.mockResolvedValue("abc123");
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await djangoLogoutAction();

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/v1/auth/logout/");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Token abc123");
    expect(init.cache).toBe("no-store");
  });

  it("returns ok:false on a 5xx response (best-effort, doesn't throw)", async () => {
    mockedGetServerDrfToken.mockResolvedValue("abc123");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 503 })),
    );

    const result = await djangoLogoutAction();

    expect(result).toEqual({ ok: false });
  });

  it("returns ok:false on a network error (best-effort, doesn't throw)", async () => {
    mockedGetServerDrfToken.mockResolvedValue("abc123");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

    const result = await djangoLogoutAction();

    expect(result).toEqual({ ok: false });
  });
});
