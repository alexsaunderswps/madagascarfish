import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerAction } from "./actions";

const ORIGINAL_API_URL = process.env.NEXT_PUBLIC_API_URL;

const VALID_INPUT = {
  email: "researcher@example.com",
  name: "Test Researcher",
  password: "long-strong-password-12",
};

describe("registerAction", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL_API_URL;
    vi.restoreAllMocks();
  });

  it("returns ok on a 201 from Django", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Registration successful." }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await registerAction(VALID_INPUT);
    expect(result).toEqual({ ok: true });
  });

  it("posts to the Django register endpoint with a JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await registerAction(VALID_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/v1/auth/register/");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.cache).toBe("no-store");
    expect(JSON.parse(init.body)).toEqual({
      email: "researcher@example.com",
      name: "Test Researcher",
      password: "long-strong-password-12",
    });
  });

  it("normalizes the email to lowercase and trims whitespace before posting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await registerAction({
      email: "  Researcher@Example.COM  ",
      name: "  Test Researcher  ",
      password: "long-strong-password-12",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      email: "researcher@example.com",
      name: "Test Researcher",
      password: "long-strong-password-12",
    });
  });

  it("masks duplicate-email 400 responses as a successful registration (enumeration resistance)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ email: ["An account with this email already exists."] }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await registerAction(VALID_INPUT);
    expect(result).toEqual({ ok: true });
  });

  it("surfaces password validation errors so the form can render them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            password: ["This password is too short. It must contain at least 12 characters."],
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await registerAction({
      ...VALID_INPUT,
      password: "short",
    });

    expect(result).toEqual({
      ok: false,
      errors: {
        password:
          "This password is too short. It must contain at least 12 characters.",
      },
    });
  });

  it("treats a non-duplicate email validation error as a surfaced field error", async () => {
    // E.g. some future change adds an "Email is on a banned domain" check — not
    // the duplicate-email message, so the user should see it.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ email: ["Email domain is not allowed."] }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await registerAction(VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      errors: { email: "Email domain is not allowed." },
    });
  });

  it("returns a transient error on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    const result = await registerAction(VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      transientError:
        "Could not reach the server. Check your connection and try again.",
    });
  });

  it("returns a transient error on a 5xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 503 })),
    );

    const result = await registerAction(VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      transientError: "The server is unavailable. Please try again in a moment.",
    });
  });

  it("rejects empty inputs without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await registerAction({ email: "", name: "", password: "" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      errors: { form: "Email, name, and password are all required." },
    });
  });
});
