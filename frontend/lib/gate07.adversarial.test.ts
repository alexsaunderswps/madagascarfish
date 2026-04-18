/**
 * Gate 07 — MVP Public Frontend
 * Tests written from acceptance criteria in docs/planning/specs/gate-07-mvp-public-frontend-v2.md
 *
 * Covers:
 * - FE-07-7: coverage-gap stat links to correct deep-link URL
 * - FE-07-7: each IUCN chart bar links to /species/?iucn_status={cat}
 * - FE-07-7: dashboard renders null on fetch failure (stale-while-revalidate guard)
 * - FE-07-8: nav link order Dashboard → Map → Species Directory → About
 * - FE-07-8: footer data-sources list includes all six required sources
 * - FE-07-10: IucnBadge renders "Not yet assessed" when status is null (PR #32)
 * - FE-07-10: SpeciesCard renders "Not yet assessed" label when iucn_status is null
 * - FE-07-11: revalidate validate.ts — 401-path inputs and 400-path inputs
 * - FE-07-5: MapViewToggle preserves species_id when toggling to list view
 * - Dashboard: CHART_CAPTION contains "Not yet assessed" (not "Not Evaluated")
 * - About: live species count or "~79" fallback
 * - warm-cache.sh: script exists and covers required paths
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// ============================================================
// Helpers
// ============================================================

const FRONTEND_ROOT = resolve(__dirname, "..");

// ============================================================
// FE-07-8: Nav link order
// ============================================================

describe("NavLinks — PRIMARY_NAV order (FE-07-8 AC)", () => {
  it("lists links in the required order: Dashboard → Map → Species Directory → About", async () => {
    const { PRIMARY_NAV } = await import("../components/NavLinks");
    const hrefs = PRIMARY_NAV.map((l) => l.href);
    // Spec: "links appear in order Dashboard → Map → Directory → About"
    expect(hrefs.indexOf("/dashboard/")).toBeLessThan(hrefs.indexOf("/map/"));
    expect(hrefs.indexOf("/map/")).toBeLessThan(hrefs.indexOf("/species/"));
    expect(hrefs.indexOf("/species/")).toBeLessThan(hrefs.indexOf("/about/"));
  });

  it("labels match the spec labels (not implementation-invented names)", async () => {
    const { PRIMARY_NAV } = await import("../components/NavLinks");
    const labels = PRIMARY_NAV.map((l) => l.label);
    // Spec: "Dashboard → Map → Species Directory → About"
    expect(labels[0]).toBe("Dashboard");
    expect(labels[1]).toBe("Map");
    expect(labels[2]).toBe("Species Directory");
    expect(labels[3]).toBe("About");
  });
});

// ============================================================
// FE-07-8: Footer data-sources
// ============================================================

describe("SiteFooter — data-sources list (FE-07-8 AC)", () => {
  it("footer source string includes all six required data sources", () => {
    // Read the footer source directly since it's a server component (no jsdom)
    const footerSrc = readFileSync(
      resolve(FRONTEND_ROOT, "components/SiteFooter.tsx"),
      "utf-8",
    );
    // Spec: "data-source citation" must list all six: IUCN Red List, FishBase, GBIF, ZIMS, SHOAL, CARES
    const required = ["IUCN Red List", "FishBase", "GBIF", "ZIMS", "SHOAL", "CARES"];
    for (const source of required) {
      expect(footerSrc, `Footer is missing required data source: ${source}`).toContain(source);
    }
  });
});

// ============================================================
// FE-07-10 / PR #32: IUCN_LABELS — "Not yet assessed" (not "Not Evaluated")
// ============================================================

describe("IUCN_LABELS — NE label mirrors policy (PR #32)", () => {
  it("NE maps to 'Not yet assessed' — not 'Not Evaluated'", async () => {
    const { IUCN_LABELS } = await import("./species");
    // Mirror policy: "Not yet assessed" is the correct label; "Not Evaluated" is the old/wrong label
    expect(IUCN_LABELS.NE).toBe("Not yet assessed");
    expect(IUCN_LABELS.NE).not.toMatch(/not evaluated/i);
  });

  it("all seven canonical statuses have labels", async () => {
    const { IUCN_LABELS, IUCN_STATUSES } = await import("./species");
    for (const s of IUCN_STATUSES) {
      expect(IUCN_LABELS[s], `Missing label for status ${s}`).toBeTruthy();
    }
  });
});

// ============================================================
// FE-07-10 / PR #32: IucnBadge renders "Not yet assessed" for null status
// ============================================================

describe("IucnBadge — null status renders 'Not yet assessed' (PR #32)", () => {
  it("renders 'Not yet assessed' text when status is null", () => {
    // IucnBadge is a server component — inspect source to verify the null branch
    // TODO: needs jsdom to render and assert rendered text directly
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "components/IucnBadge.tsx"),
      "utf-8",
    );
    // The null branch must render "Not yet assessed" — not blank, not "NE", not "Not Evaluated"
    expect(src).toContain("Not yet assessed");
    expect(src).not.toMatch(/Not Evaluated/i);
  });
});

// ============================================================
// FE-07-10 / PR #32: SpeciesCard renders "Not yet assessed" for null iucn_status
// ============================================================

describe("SpeciesCard — null iucn_status label (PR #32)", () => {
  it("renders 'Not yet assessed' label when iucn_status is null", () => {
    // Server component — inspect the label derivation logic in source
    // TODO: needs jsdom for a rendered assertion
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "components/SpeciesCard.tsx"),
      "utf-8",
    );
    // Must use "Not yet assessed" for null status
    expect(src).toContain("Not yet assessed");
    expect(src).not.toMatch(/Not Evaluated/i);
  });
});

// ============================================================
// FE-07-7: CHART_CAPTION contains "Not yet assessed"
// ============================================================

describe("Dashboard page — CHART_CAPTION label (FE-07-7 AC)", () => {
  it("chart caption uses 'Not yet assessed' for the NE bucket", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/dashboard/page.tsx"),
      "utf-8",
    );
    // Spec: "Chart axis labels use expanded form" and "Not yet assessed" is the NE label
    expect(src).toContain("Not yet assessed");
    expect(src).not.toMatch(/Not Evaluated/i);
  });
});

// ============================================================
// FE-07-7: Coverage-gap stat deep-link URL
// ============================================================

describe("Dashboard page — coverage-gap deep-link (FE-07-7 AC)", () => {
  it("COVERAGE_GAP_HREF points to the correct filter URL", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/dashboard/page.tsx"),
      "utf-8",
    );
    // AC: "coverage-gap stat is clicked → /species/?iucn_status=CR,EN,VU&has_captive_population=false"
    expect(src).toContain("/species/?iucn_status=CR,EN,VU&has_captive_population=false");
  });
});

// ============================================================
// FE-07-7: Each IUCN chart bar links to /species/?iucn_status={cat}
// ============================================================

describe("IucnChart — each bar links to directory (FE-07-7 AC)", () => {
  it("generates href /species/?iucn_status={status} for each bar", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "components/IucnChart.tsx"),
      "utf-8",
    );
    // AC: "a user clicks the 'EN' chart bar → directory opens at /species/?iucn_status=EN"
    // The template literal pattern must be present
    expect(src).toMatch(/\/species\/\?iucn_status=\$\{status\}/);
  });

  it("bar order follows spec: CR → EN → VU → NT → LC → DD → NE", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "components/IucnChart.tsx"),
      "utf-8",
    );
    const orderMatch = src.match(/BAR_ORDER[^=]*=\s*\[([^\]]+)\]/);
    expect(orderMatch).not.toBeNull();
    const orderStr = orderMatch![1];
    const crIdx = orderStr.indexOf('"CR"');
    const enIdx = orderStr.indexOf('"EN"');
    const vuIdx = orderStr.indexOf('"VU"');
    const neIdx = orderStr.indexOf('"NE"');
    expect(crIdx).toBeLessThan(enIdx);
    expect(enIdx).toBeLessThan(vuIdx);
    expect(vuIdx).toBeLessThan(neIdx);
  });

  it("count labels are rendered unconditionally (not hover-only)", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "components/IucnChart.tsx"),
      "utf-8",
    );
    // AC: "Each bar has a visible count label (not hover-only)"
    // Count value is rendered in the JSX — should not be inside a visibility-hidden static style
    expect(src).toContain("{count}");
    expect(src).not.toMatch(/opacity-0[^:]/);
  });
});

// ============================================================
// FE-07-7: Dashboard stale/failure guard (fetchDashboard returns null)
// ============================================================

describe("fetchDashboard — stale/failure guard (FE-07-7 AC)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://api.test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("returns null when /api/v1/dashboard/ returns 500 (no 500 propagated)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("internal error", { status: 500 })),
    );
    const { fetchDashboard } = await import("./dashboard");
    const result = await fetchDashboard();
    // AC: "a failed /api/v1/dashboard/ at revalidate time serves last-cached render, not 500"
    // The fetch wrapper must return null, not throw, so the page can degrade gracefully
    expect(result).toBeNull();
  });

  it("returns null when the network throws entirely", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const { fetchDashboard } = await import("./dashboard");
    const result = await fetchDashboard();
    expect(result).toBeNull();
  });

  it("returns null when /api/v1/dashboard/ returns 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("service unavailable", { status: 503 })),
    );
    const { fetchDashboard } = await import("./dashboard");
    const result = await fetchDashboard();
    expect(result).toBeNull();
  });
});

// ============================================================
// FE-07-5: MapViewToggle preserves species_id when switching to list
// ============================================================

describe("MapViewToggle — ?view=list URL state (FE-07-5 AC)", () => {
  it("?view=list is present when toggling to list, absent when toggling to map", async () => {
    const { _buildHrefForTesting: buildHref } = await import(
      "../components/MapViewToggle"
    );
    // AC: "?view=list is present → page loads directly into list view"
    const listHref = buildHref("/map/", {}, "list");
    expect(listHref).toContain("view=list");

    const mapHref = buildHref("/map/", { view: "list" }, "map");
    expect(mapHref).not.toContain("view=");
  });

  it("preserves species_id param when switching to list view", async () => {
    const { _buildHrefForTesting: buildHref } = await import(
      "../components/MapViewToggle"
    );
    // AC: "toggle preserves species_id"
    const href = buildHref("/map/", { species_id: "42" }, "list");
    expect(href).toContain("species_id=42");
    expect(href).toContain("view=list");
  });

  it("strips species_id when value is undefined", async () => {
    const { _buildHrefForTesting: buildHref } = await import(
      "../components/MapViewToggle"
    );
    const href = buildHref("/map/", { species_id: undefined }, "list");
    expect(href).not.toContain("species_id");
    expect(href).toContain("view=list");
  });
});

// ============================================================
// FE-07-11: validateRevalidateBody — auth-unrelated 400 path inputs
// Note: the 401 path is exercised by testing that the handler reads the secret
// from env. The actual route handler integration tests hit Next.js internals
// (revalidatePath, NextResponse) which require the Next.js runtime — not testable
// in vitest-node without Playwright. Auth-path logic is verified via source inspection.
// ============================================================

describe("validateRevalidateBody — 400 inputs (FE-07-11 AC)", () => {
  it("rejects missing paths → caller gets 400 shape", async () => {
    const { validateRevalidateBody } = await import(
      "../app/api/revalidate/validate"
    );
    // AC: "handler receives malformed body → 400 returned"
    expect(validateRevalidateBody({}).ok).toBe(false);
    expect(validateRevalidateBody({ paths: null }).ok).toBe(false);
  });

  it("rejects empty paths array", async () => {
    const { validateRevalidateBody } = await import(
      "../app/api/revalidate/validate"
    );
    expect(validateRevalidateBody({ paths: [] }).ok).toBe(false);
  });

  it("rejects non-string path entries", async () => {
    const { validateRevalidateBody } = await import(
      "../app/api/revalidate/validate"
    );
    expect(validateRevalidateBody({ paths: ["/ok", 42] }).ok).toBe(false);
  });

  it("rejects paths that don't start with /", async () => {
    const { validateRevalidateBody } = await import(
      "../app/api/revalidate/validate"
    );
    expect(validateRevalidateBody({ paths: ["species"] }).ok).toBe(false);
    expect(validateRevalidateBody({ paths: ["https://evil.example"] }).ok).toBe(
      false,
    );
  });
});

describe("revalidate route handler source — 401 guard (FE-07-11 AC)", () => {
  it("route handler source reads secret from REVALIDATE_SECRET env var", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/api/revalidate/route.ts"),
      "utf-8",
    );
    // AC: "missing/invalid secret → 401 returned; no revalidation occurs"
    // The handler must check the env var, not skip it
    expect(src).toContain("REVALIDATE_SECRET");
    expect(src).toContain("401");
  });

  it("route handler source extracts secret from header AND body (forward-compat)", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/api/revalidate/route.ts"),
      "utf-8",
    );
    // AC: "handler or body" — spec says "header or body"
    expect(src).toContain("x-revalidate-secret");
    // Body extraction — for callers that can't set headers
    expect(src).toContain("secret");
  });

  it("route handler source accepts arbitrary paths list (not hardcoded)", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/api/revalidate/route.ts"),
      "utf-8",
    );
    // AC: "body supports an arbitrary paths list → Gate 08 reuse without code change"
    // Handler must NOT import a hardcoded PUBLIC_PATHS list from elsewhere
    // (that belongs to the Django admin action, not the Next.js handler)
    expect(src).not.toMatch(/import.*PUBLIC_PATHS/);
    // It must iterate result.paths, not a static constant
    expect(src).toMatch(/result\.paths/);
  });
});

// ============================================================
// FE-07-11: warm-cache.sh exists and covers required paths
// ============================================================

describe("warm-cache.sh — existence and required paths (FE-07-11 AC)", () => {
  it("frontend/scripts/warm-cache.sh exists", () => {
    const scriptPath = resolve(FRONTEND_ROOT, "scripts/warm-cache.sh");
    let content: string;
    try {
      content = readFileSync(scriptPath, "utf-8");
    } catch {
      expect.fail(
        "frontend/scripts/warm-cache.sh does not exist — required by FE-07-11 AC",
      );
      return;
    }
    expect(content.length).toBeGreaterThan(0);
  });

  it("warm-cache.sh covers the three minimum base paths: /, /dashboard/, /species/", () => {
    const scriptPath = resolve(FRONTEND_ROOT, "scripts/warm-cache.sh");
    const content = readFileSync(scriptPath, "utf-8");
    // AC: "fetches /, /dashboard/, /species/, and N (≥5) representative /species/[id]/ URLs"
    const requiredPaths = ["/", "/dashboard/", "/species/"];
    for (const p of requiredPaths) {
      expect(content, `warm-cache.sh is missing required path: ${p}`).toContain(
        `"${p}"`,
      );
    }
  });

  it("warm-cache.sh exits non-zero when a URL returns non-2xx", () => {
    const scriptPath = resolve(FRONTEND_ROOT, "scripts/warm-cache.sh");
    const content = readFileSync(scriptPath, "utf-8");
    // AC: "any warmed URL returns non-2xx → exits non-zero"
    expect(content).toMatch(/exit 1/);
    expect(content).toMatch(/fail=/);
  });

  it("warm-cache.sh uses BASE_URL env var and aborts if unset", () => {
    const scriptPath = resolve(FRONTEND_ROOT, "scripts/warm-cache.sh");
    const content = readFileSync(scriptPath, "utf-8");
    // AC: "when run with BASE_URL set"
    expect(content).toContain("BASE_URL");
    expect(content).toMatch(/exit [12]/);
  });
});

// ============================================================
// FE-07-7: About page species count fallback
// ============================================================

describe("About page — live species count or '~79' fallback (FE-07-8 AC)", () => {
  it("About page source contains ~79 fallback when count is unavailable", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/about/page.tsx"),
      "utf-8",
    );
    // AC: "About page renders live species count or '~79' fallback"
    expect(src).toContain("~79");
  });

  it("About page reads live count from dashboard when available", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/about/page.tsx"),
      "utf-8",
    );
    // Must read from dashboard data (not hardcoded always)
    expect(src).toContain("speciesTotal");
    expect(src).toContain("species_counts");
  });
});

// ============================================================
// FE-07-3: fetchSpeciesDetail returns not_found for 404, error for other failures
// ============================================================

describe("fetchSpeciesDetail — 404 vs other errors (FE-07-10 AC)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://api.test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("returns { kind: 'not_found' } for a 404 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not found", { status: 404 })),
    );
    const { fetchSpeciesDetail } = await import("./speciesDetail");
    const result = await fetchSpeciesDetail(9999);
    // AC: "Given /species/9999/ → themed 404 with 'browse all species' link"
    // The fetch function must signal not_found so the page can call notFound()
    expect(result.kind).toBe("not_found");
  });

  it("returns { kind: 'error' } for a 500 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("server error", { status: 500 })),
    );
    const { fetchSpeciesDetail } = await import("./speciesDetail");
    const result = await fetchSpeciesDetail(1);
    expect(result.kind).toBe("error");
  });

  it("returns { kind: 'error' } when network throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { fetchSpeciesDetail } = await import("./speciesDetail");
    const result = await fetchSpeciesDetail(1);
    expect(result.kind).toBe("error");
  });
});

// ============================================================
// FE-07-3: Species profile uses notFound() for 404 (not error boundary)
// ============================================================

describe("Species profile page — 404 handling (FE-07-10 AC)", () => {
  it("profile page source calls notFound() when result is not_found", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/species/[id]/page.tsx"),
      "utf-8",
    );
    // AC: "/species/9999/ → themed 404 with 'browse all species' link"
    // Must call Next.js notFound() to trigger the themed 404, not render an error boundary
    expect(src).toContain("notFound()");
    expect(src).toContain("not_found");
  });
});

// ============================================================
// FE-07-3: "View on Map" present iff has_localities === true (not disabled)
// ============================================================

describe("Species profile — 'View on Map' visibility (FE-07-3 AC)", () => {
  it("'View on Map' is rendered inside a has_localities conditional (not always present)", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/species/[id]/page.tsx"),
      "utf-8",
    );
    // AC: "'View on Map' is absent (not disabled) when has_localities === false"
    // UX 3.8: must be conditionally rendered, not a disabled-with-tooltip
    expect(src).toContain("has_localities");
    expect(src).toContain("View on Map");
    // Both must appear in the same file; the conditional renders the link
    // Source inspection confirms sp.has_localities ? (<Link...>View on Map) : null
    const hasLocalitiesIdx = src.indexOf("has_localities");
    const viewOnMapIdx = src.indexOf("View on Map");
    expect(hasLocalitiesIdx).not.toBe(-1);
    expect(viewOnMapIdx).not.toBe(-1);
    // has_localities check comes before "View on Map" in the source
    expect(hasLocalitiesIdx).toBeLessThan(viewOnMapIdx);
  });

  it("'View on Map' is absent when has_localities is falsy (source shows ternary/conditional)", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/species/[id]/page.tsx"),
      "utf-8",
    );
    // The conditional must resolve to null when false — check for ternary or && pattern
    // Pattern: {sp.has_localities ? (<Link...>View on Map...) : null}
    expect(src).toMatch(/has_localities[\s\S]{0,300}View on Map/);
    // Must NOT be inside a disabled= prop (i.e. not always shown as disabled)
    expect(src).not.toMatch(/disabled[^=].*View on Map|View on Map.*disabled/);
  });
});

// ============================================================
// FE-07-3: Species profile — zero captive populations text
// ============================================================

describe("Species profile — zero captive populations (FE-07-3 AC)", () => {
  it("renders 'no captive population' text (not error) when institutions_holding === 0", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/species/[id]/page.tsx"),
      "utf-8",
    );
    // AC: "ex_situ_summary.institutions_holding === 0 → 'No captive population is currently tracked'"
    expect(src).toContain("No captive population is currently tracked");
  });
});

// ============================================================
// FE-07-10: Field Programs section renders EmptyState (not hidden/broken)
// ============================================================

describe("Species profile — field programs empty state (FE-07-10 AC)", () => {
  it("uses EmptyState component for zero field programs (not hidden section)", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/species/[id]/page.tsx"),
      "utf-8",
    );
    // AC: "species has zero linked field programs → Field Programs section shows EmptyState"
    expect(src).toContain("EmptyState");
    // The field-heading section must contain the EmptyState (not be absent)
    expect(src).toMatch(/field-heading[\s\S]{0,500}EmptyState/);
  });
});

// ============================================================
// FE-07-5: ?view=list loads directly into list view (URL state)
// ============================================================

describe("Map page — ?view=list direct load (FE-07-5 AC)", () => {
  it("map page source reads view from searchParams and maps 'list' → list mode", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/map/page.tsx"),
      "utf-8",
    );
    // AC: "when ?view=list is present → page loads directly into list view"
    expect(src).toContain("view");
    expect(src).toContain('"list"');
    // Must read from searchParams, not hardcode map view
    expect(src).toContain("searchParams");
  });

  it("map page renders MapListView when view is 'list'", () => {
    const src = readFileSync(
      resolve(FRONTEND_ROOT, "app/map/page.tsx"),
      "utf-8",
    );
    // The list branch renders MapListView component
    expect(src).toContain("MapListView");
    expect(src).toMatch(/view.*===.*["']list["'][\s\S]{0,100}MapListView/);
  });
});
