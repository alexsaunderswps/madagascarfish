import { describe, expect, it } from "vitest";
import { isActive, mostSpecificActiveHref } from "./NavLinks";

describe("isActive", () => {
  it("marks the exact match as active, with or without trailing slash", () => {
    expect(isActive("/dashboard/", "/dashboard/")).toBe(true);
    expect(isActive("/dashboard", "/dashboard/")).toBe(true);
    expect(isActive("/dashboard/", "/dashboard")).toBe(true);
  });

  it("marks nested routes as active under the parent", () => {
    expect(isActive("/species/42/", "/species/")).toBe(true);
    expect(isActive("/species/42", "/species/")).toBe(true);
  });

  it("does not mark unrelated paths as active", () => {
    expect(isActive("/map/", "/species/")).toBe(false);
    expect(isActive("/", "/dashboard/")).toBe(false);
    expect(isActive("/about/", "/dashboard/")).toBe(false);
  });

  it("distinguishes sibling prefixes that share a string prefix", () => {
    expect(isActive("/speciesfoo/", "/species/")).toBe(false);
  });
});

describe("mostSpecificActiveHref", () => {
  const links = [
    { href: "/dashboard/", label: "Dashboard" },
    { href: "/dashboard/coordinator/", label: "Coordinator" },
    { href: "/species/", label: "Species" },
  ];

  it("picks the longer href when both match (coordinator wins over dashboard)", () => {
    expect(mostSpecificActiveHref("/dashboard/coordinator/", links)).toBe(
      "/dashboard/coordinator/",
    );
  });

  it("picks the parent when only the parent matches", () => {
    expect(mostSpecificActiveHref("/dashboard/", links)).toBe("/dashboard/");
  });

  it("returns null when nothing matches", () => {
    expect(mostSpecificActiveHref("/totally-other/", links)).toBeNull();
  });

  it("handles trailing-slash-less pathnames", () => {
    expect(mostSpecificActiveHref("/dashboard/coordinator", links)).toBe(
      "/dashboard/coordinator/",
    );
  });
});
