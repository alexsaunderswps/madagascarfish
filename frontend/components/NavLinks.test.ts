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
    { href: "/dashboard/", labelKey: "dashboard" },
    { href: "/dashboard/coordinator/", labelKey: "coordinator" },
    { href: "/species/", labelKey: "speciesDirectory" },
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
    { href: "/dashboard/", labelKey: "dashboard" },
    { href: "/dashboard/coordinator/", labelKey: "coordinator", minTier: 3 },
    { href: "/map/", labelKey: "map" },
  ];

  it("hides minTier links from anonymous viewers (tier 0)", () => {
    expect(visibleNavLinks(links, 0).map((l) => l.labelKey)).toEqual([
      "dashboard",
      "map",
    ]);
  });

  it("hides Coordinator from Tier 1 (public) and Tier 2 (researcher)", () => {
    expect(visibleNavLinks(links, 1).map((l) => l.labelKey)).toEqual([
      "dashboard",
      "map",
    ]);
    expect(visibleNavLinks(links, 2).map((l) => l.labelKey)).toEqual([
      "dashboard",
      "map",
    ]);
  });

  it("shows Coordinator at Tier 3+ (Coordinator, Program Manager, Admin)", () => {
    for (const tier of [3, 4, 5]) {
      expect(visibleNavLinks(links, tier).map((l) => l.labelKey)).toEqual([
        "dashboard",
        "coordinator",
        "map",
      ]);
    }
  });
});

describe("visibleNavLinks — requireClaimApproved", () => {
  const links: NavLink[] = [
    { href: "/dashboard/", labelKey: "dashboard" },
    {
      href: "/dashboard/institution/",
      labelKey: "institution",
      minTier: 2,
      requireClaimApproved: true,
    },
  ];

  it("hides claim-gated links when claim_status is 'none'", () => {
    expect(visibleNavLinks(links, 2, "none").map((l) => l.labelKey)).toEqual([
      "dashboard",
    ]);
  });

  it("hides claim-gated links when claim is pending", () => {
    expect(
      visibleNavLinks(links, 2, "pending").map((l) => l.labelKey),
    ).toEqual(["dashboard"]);
  });

  it("hides claim-gated links when claim was rejected", () => {
    expect(
      visibleNavLinks(links, 2, "rejected").map((l) => l.labelKey),
    ).toEqual(["dashboard"]);
  });

  it("shows claim-gated links once claim is approved", () => {
    expect(
      visibleNavLinks(links, 2, "approved").map((l) => l.labelKey),
    ).toEqual(["dashboard", "institution"]);
  });

  it("still requires minTier even with approved claim", () => {
    // A Tier-1 user with an approved claim is still gated by minTier.
    expect(
      visibleNavLinks(links, 1, "approved").map((l) => l.labelKey),
    ).toEqual(["dashboard"]);
  });
});

describe("authNavItems", () => {
  it("renders nothing when the feature flag is off (Story 3 AC-3.3)", () => {
    expect(authNavItems(false, false)).toEqual([]);
    expect(authNavItems(false, true)).toEqual([]);
  });

  it("returns labelKey strings (translated by the rendering layer)", () => {
    const items = authNavItems(true, false);
    expect(items).toEqual([
      { kind: "link", href: "/login", labelKey: "signIn" },
      { kind: "link", href: "/signup", labelKey: "signUp" },
    ]);
  });

  it("returns labelKey strings for authenticated users", () => {
    const items = authNavItems(true, true);
    expect(items).toEqual([
      { kind: "link", href: "/account", labelKey: "account" },
      { kind: "logout", href: "#logout", labelKey: "signOut" },
    ]);
  });
});
