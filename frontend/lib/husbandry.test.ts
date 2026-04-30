import { describe, expect, it } from "vitest";

import {
  collectDifficultyFactors,
  isReviewStale,
  narrativeExcerpt,
  REVIEW_STALE_AFTER_DAYS,
  type SpeciesHusbandry,
  teaserPresentation,
  teaserSentenceToken,
} from "./husbandry";

function makeHusbandry(overrides: Partial<SpeciesHusbandry> = {}): SpeciesHusbandry {
  return {
    species_id: 1,
    water_temp_c_min: null,
    water_temp_c_max: null,
    water_ph_min: null,
    water_ph_max: null,
    water_hardness_dgh_min: null,
    water_hardness_dgh_max: null,
    water_hardness_dkh_min: null,
    water_hardness_dkh_max: null,
    water_flow: "",
    water_notes: "",
    tank_min_volume_liters: null,
    tank_min_footprint_cm: "",
    tank_aquascape: "",
    tank_substrate: "",
    tank_cover: "",
    tank_notes: "",
    diet_accepted_foods: [],
    diet_live_food_required: false,
    diet_feeding_frequency: "",
    diet_notes: "",
    behavior_temperament: "",
    behavior_recommended_sex_ratio: "",
    behavior_schooling: "",
    behavior_community_compatibility: "",
    behavior_notes: "",
    breeding_spawning_mode: "",
    breeding_triggers: "",
    breeding_egg_count_typical: "",
    breeding_fry_care: "",
    breeding_survival_bottlenecks: "",
    breeding_notes: "",
    difficulty_adult_size: "",
    difficulty_space_demand: "",
    difficulty_temperament_challenge: "",
    difficulty_water_parameter_demand: "",
    difficulty_dietary_specialization: "",
    difficulty_breeding_complexity: "",
    difficulty_other: "",
    sourcing_cares_registered_breeders: false,
    sourcing_notes: "",
    narrative: "",
    contributors: "",
    last_reviewed_by: null,
    last_reviewed_at: null,
    review_is_stale: false,
    sources: [],
    ...overrides,
  };
}

describe("isReviewStale", () => {
  // Anchor "now" so tests are deterministic independent of wall clock.
  const now = new Date("2026-04-18T12:00:00Z");

  it("returns true when last_reviewed_at is null", () => {
    expect(isReviewStale(null, now)).toBe(true);
  });

  it("is NOT stale at exactly the boundary (730 days ago)", () => {
    // 730 days before 2026-04-18 is 2024-04-19 (reviewed exactly 24 months ago).
    const boundary = new Date(now);
    boundary.setUTCDate(boundary.getUTCDate() - REVIEW_STALE_AFTER_DAYS);
    const iso = boundary.toISOString().slice(0, 10);
    expect(isReviewStale(iso, now)).toBe(false);
  });

  it("is NOT stale one day inside the boundary (24 months minus 1 day)", () => {
    const inside = new Date(now);
    inside.setUTCDate(inside.getUTCDate() - (REVIEW_STALE_AFTER_DAYS - 1));
    const iso = inside.toISOString().slice(0, 10);
    expect(isReviewStale(iso, now)).toBe(false);
  });

  it("IS stale one day past the boundary (24 months plus 1 day)", () => {
    const past = new Date(now);
    past.setUTCDate(past.getUTCDate() - (REVIEW_STALE_AFTER_DAYS + 1));
    const iso = past.toISOString().slice(0, 10);
    expect(isReviewStale(iso, now)).toBe(true);
  });

  it("returns true for an unparseable date string", () => {
    expect(isReviewStale("not-a-date", now)).toBe(true);
  });
});

describe("teaserPresentation", () => {
  it("does not render when has_husbandry is false", () => {
    const out = teaserPresentation({
      has_husbandry: false,
      cares_status: "priority",
      shoal_priority: true,
    });
    expect(out.render).toBe(false);
  });

  it("renders standard variant with no chip when neither flag set", () => {
    const out = teaserPresentation({
      has_husbandry: true,
      cares_status: null,
      shoal_priority: false,
    });
    expect(out).toEqual({ render: true, variant: "standard", chipToken: null });
  });

  it("treats empty-string cares_status as not set", () => {
    const out = teaserPresentation({
      has_husbandry: true,
      cares_status: "",
      shoal_priority: false,
    });
    expect(out.variant).toBe("standard");
    expect(out.chipToken).toBeNull();
  });

  it("emphasizes with CARES-only chip token when only cares_status is set", () => {
    const out = teaserPresentation({
      has_husbandry: true,
      cares_status: "priority",
      shoal_priority: false,
    });
    expect(out.variant).toBe("emphasized");
    expect(out.chipToken).toBe("cares");
  });

  it("emphasizes with SHOAL-only chip token when only shoal_priority is set", () => {
    const out = teaserPresentation({
      has_husbandry: true,
      cares_status: null,
      shoal_priority: true,
    });
    expect(out.variant).toBe("emphasized");
    expect(out.chipToken).toBe("shoal");
  });

  it("merges both flags into a single chip token — never stacks two", () => {
    const out = teaserPresentation({
      has_husbandry: true,
      cares_status: "CCR",
      shoal_priority: true,
    });
    expect(out.variant).toBe("emphasized");
    expect(out.chipToken).toBe("caresShoal");
  });
});

describe("teaserSentenceToken", () => {
  it("returns 'default' when no priority flags set", () => {
    expect(
      teaserSentenceToken({
        has_husbandry: true,
        cares_status: null,
        shoal_priority: false,
      }),
    ).toBe("default");
  });

  it("returns 'caresShoal' when both flags set", () => {
    expect(
      teaserSentenceToken({
        has_husbandry: true,
        cares_status: "priority",
        shoal_priority: true,
      }),
    ).toBe("caresShoal");
  });

  it("returns 'cares' when only CARES set", () => {
    expect(
      teaserSentenceToken({
        has_husbandry: true,
        cares_status: "priority",
        shoal_priority: false,
      }),
    ).toBe("cares");
  });

  it("returns 'shoal' when only SHOAL set", () => {
    expect(
      teaserSentenceToken({
        has_husbandry: true,
        cares_status: null,
        shoal_priority: true,
      }),
    ).toBe("shoal");
  });
});

describe("collectDifficultyFactors — elision (AC-09.5)", () => {
  it("returns empty array when all factors blank", () => {
    expect(collectDifficultyFactors(makeHusbandry())).toEqual([]);
  });

  it("skips blank factors and keeps populated ones in declared order", () => {
    const h = makeHusbandry({
      difficulty_water_parameter_demand: "demanding — stable soft water required",
      difficulty_breeding_complexity: "requires conditioning + trigger",
    });
    const factors = collectDifficultyFactors(h);
    expect(factors).toHaveLength(2);
    expect(factors[0]?.key).toBe("difficulty_water_parameter_demand");
    expect(factors[0]?.token).toBe("waterParams");
    expect(factors[1]?.key).toBe("difficulty_breeding_complexity");
    expect(factors[1]?.token).toBe("breedingComplexity");
    expect(factors[0]?.value).toBe("demanding — stable soft water required");
  });

  it("treats whitespace-only strings as blank", () => {
    const h = makeHusbandry({
      difficulty_adult_size: "   ",
      difficulty_other: "notable",
    });
    const factors = collectDifficultyFactors(h);
    expect(factors).toHaveLength(1);
    expect(factors[0]?.key).toBe("difficulty_other");
    expect(factors[0]?.token).toBe("other");
  });

  it("never produces a single aggregate difficulty label", () => {
    const h = makeHusbandry({
      difficulty_adult_size: "large",
      difficulty_temperament_challenge: "aggressive toward conspecifics",
    });
    const serialized = JSON.stringify(collectDifficultyFactors(h));
    // Assert against the adversarial strings called out in the spec.
    expect(serialized).not.toMatch(/\bBeginner\b/);
    expect(serialized).not.toMatch(/\bIntermediate\b/);
    expect(serialized).not.toMatch(/\bAdvanced\b/);
    expect(serialized).not.toMatch(/\bExpert-only\b/);
  });
});

describe("narrativeExcerpt", () => {
  it("returns full string when under the limit", () => {
    expect(narrativeExcerpt("Short narrative.")).toBe("Short narrative.");
  });

  it("collapses whitespace", () => {
    expect(narrativeExcerpt("Two\n\nparagraphs   here.")).toBe("Two paragraphs here.");
  });

  it("truncates on a word boundary with an ellipsis when over the limit", () => {
    const long = "word ".repeat(100).trim();
    const out = narrativeExcerpt(long, 40);
    expect(out.length).toBeLessThanOrEqual(41); // 40 + ellipsis
    expect(out.endsWith("…")).toBe(true);
  });
});
