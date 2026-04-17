import { describe, expect, it } from "vitest";

import { validateRevalidateBody } from "./validate";

describe("validateRevalidateBody", () => {
  it("accepts a non-empty array of absolute paths", () => {
    const res = validateRevalidateBody({ paths: ["/species", "/dashboard"] });
    expect(res).toEqual({ ok: true, paths: ["/species", "/dashboard"] });
  });

  it("rejects a non-object body", () => {
    expect(validateRevalidateBody(null).ok).toBe(false);
    expect(validateRevalidateBody("/species").ok).toBe(false);
    expect(validateRevalidateBody(42).ok).toBe(false);
  });

  it("rejects missing or non-array paths", () => {
    expect(validateRevalidateBody({}).ok).toBe(false);
    expect(validateRevalidateBody({ paths: "/species" }).ok).toBe(false);
    expect(validateRevalidateBody({ paths: null }).ok).toBe(false);
  });

  it("rejects an empty paths array", () => {
    expect(validateRevalidateBody({ paths: [] }).ok).toBe(false);
  });

  it("rejects non-string entries", () => {
    expect(validateRevalidateBody({ paths: ["/species", 42] }).ok).toBe(false);
  });

  it("rejects paths that don't start with /", () => {
    expect(validateRevalidateBody({ paths: ["species"] }).ok).toBe(false);
    expect(validateRevalidateBody({ paths: ["https://evil.example"] }).ok).toBe(false);
  });

  it("rejects paths with newline characters", () => {
    expect(validateRevalidateBody({ paths: ["/species\n/dashboard"] }).ok).toBe(false);
  });

  it("caps at 50 paths per request", () => {
    const many = Array.from({ length: 51 }, (_, i) => `/p${i}`);
    expect(validateRevalidateBody({ paths: many }).ok).toBe(false);
  });
});
