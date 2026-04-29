import { describe, expect, it } from "vitest";
import {
  authNavItems,
  isActive,
  mostSpecificActiveHref,
  visibleNavLinks,
  type NavLink,
} from "./NavLinks";

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

describe("visibleNavLinks", () => {
  const links: NavLink[] = [
    { href: "/dashboard/", label: "Dashboard" },
    { href: "/dashboard/coordinator/", label: "Coordinator", minTier: 3 },
    { href: "/map/", label: "Map" },
  ];

  it("hides minTier links from anonymous viewers (tier 0)", () => {
    expect(visibleNavLinks(links, 0).map((l) => l.label)).toEqual([
      "Dashboard",
      "Map",
    ]);
  });

  it("hides Coordinator from Tier 1 (public) and Tier 2 (researcher)", () => {
    expect(visibleNavLinks(links, 1).map((l) => l.label)).toEqual([
      "Dashboard",
      "Map",
    ]);
    expect(visibleNavLinks(links, 2).map((l) => l.label)).toEqual([
      "Dashboard",
      "Map",
    ]);
  });

  it("shows Coordinator at Tier 3+ (Coordinator, Program Manager, Admin)", () => {
    for (const tier of [3, 4, 5]) {
      expect(visibleNavLinks(links, tier).map((l) => l.label)).toEqual([
        "Dashboard",
        "Coordinator",
        "Map",
      ]);
    }
  });
});

describe("authNavItems", () => {
  it("renders nothing when the feature flag is off (Story 3 AC-3.3)", () => {
    expect(authNavItems(false, false)).toEqual([]);
    expect(authNavItems(false, true)).toEqual([]);
  });

  it("renders Sign in + Sign up when authVisible and not authenticated", () => {
    const items = authNavItems(true, false);
    expect(items).toEqual([
      { kind: "link", href: "/login", label: "Sign in" },
      { kind: "link", href: "/signup", label: "Sign up" },
    ]);
  });

  it("renders Account + Sign out when authVisible and authenticated", () => {
    const items = authNavItems(true, true);
    expect(items).toEqual([
      { kind: "link", href: "/account", label: "Account" },
      { kind: "logout", href: "#logout", label: "Sign out" },
    ]);
  });
});
