import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDashboard } from "./dashboard";

describe("fetchDashboard", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://api.test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns the parsed payload on 2xx", async () => {
    const payload = {
      species_counts: {
        total: 144,
        described: 119,
        undescribed: 25,
        by_iucn_status: { CR: 14, EN: 30, VU: 8 },
      },
      ex_situ_coverage: {
        threatened_species_total: 52,
        threatened_species_with_captive_population: 3,
        threatened_species_without_captive_population: 49,
        institutions_active: 1,
        total_populations_tracked: 4,
      },
      field_programs: { active: 0, planned: 0, completed: 0 },
      last_updated: "2026-04-17T00:00:00Z",
      last_sync_at: "2026-04-17T00:00:00Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200 }),
      ),
    );

    const result = await fetchDashboard();
    expect(result).toEqual(payload);
  });

  it("returns null when the API errors (graceful fallback)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500 })),
    );

    const result = await fetchDashboard();
    expect(result).toBeNull();
  });

  it("returns null when the network throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const result = await fetchDashboard();
    expect(result).toBeNull();
  });
});
