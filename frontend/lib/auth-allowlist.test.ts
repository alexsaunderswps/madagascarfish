import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { safeRedirectTarget } from "./auth-allowlist";

const ORIGINAL_NEXTAUTH_URL = process.env.NEXTAUTH_URL;

describe("safeRedirectTarget", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_URL = "https://malagasyfishes.org";
  });

  afterEach(() => {
    process.env.NEXTAUTH_URL = ORIGINAL_NEXTAUTH_URL;
  });

  it("returns / for null/undefined/empty input", () => {
    expect(safeRedirectTarget(null)).toBe("/");
    expect(safeRedirectTarget(undefined)).toBe("/");
    expect(safeRedirectTarget("")).toBe("/");
  });

  it("returns same-site relative paths unchanged", () => {
    expect(safeRedirectTarget("/account")).toBe("/account");
    expect(safeRedirectTarget("/dashboard/coordinator")).toBe(
      "/dashboard/coordinator",
    );
    expect(safeRedirectTarget("/species/1?from=hero")).toBe(
      "/species/1?from=hero",
    );
  });

  it("rejects protocol-relative URLs (//evil.example)", () => {
    expect(safeRedirectTarget("//evil.example/path")).toBe("/");
  });

  it("rejects off-origin absolute URLs", () => {
    expect(safeRedirectTarget("https://evil.example/path")).toBe("/");
    expect(safeRedirectTarget("http://malagasyfishes.org.evil.example/")).toBe("/");
  });

  it("accepts on-origin absolute URLs and reduces to path+search+hash", () => {
    expect(
      safeRedirectTarget("https://malagasyfishes.org/account?ref=login"),
    ).toBe("/account?ref=login");
  });

  it("rejects everything when NEXTAUTH_URL is unset and input is non-relative", () => {
    delete process.env.NEXTAUTH_URL;
    expect(safeRedirectTarget("https://malagasyfishes.org/account")).toBe("/");
    // But same-site relative paths still pass.
    expect(safeRedirectTarget("/account")).toBe("/account");
  });

  it("rejects javascript: and data: URLs", () => {
    expect(safeRedirectTarget("javascript:alert(1)")).toBe("/");
    expect(safeRedirectTarget("data:text/html,<script>alert(1)</script>")).toBe("/");
  });
});
