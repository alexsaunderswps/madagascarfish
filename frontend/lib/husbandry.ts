import { ApiError, apiFetch } from "./api";

/**
 * Husbandry page data contract — mirrors
 * `backend/husbandry/serializers.py::SpeciesHusbandrySerializer`.
 *
 * Every structured field is optional/nullable on render — even if the backend
 * always returns the key, we elide the subsection when the value is blank.
 */

export interface HusbandrySource {
  label: string;
  url: string;
  order: number;
}

export interface HusbandryReviewer {
  name: string;
  orcid_id: string;
}

export interface SpeciesHusbandry {
  species_id: number;

  // Water
  water_temp_c_min: string | null;
  water_temp_c_max: string | null;
  water_ph_min: string | null;
  water_ph_max: string | null;
  water_hardness_dgh_min: string | null;
  water_hardness_dgh_max: string | null;
  water_hardness_dkh_min: string | null;
  water_hardness_dkh_max: string | null;
  water_flow: string;
  water_notes: string;

  // Tank
  tank_min_volume_liters: number | null;
  tank_min_footprint_cm: string;
  tank_aquascape: string;
  tank_substrate: string;
  tank_cover: string;
  tank_notes: string;

  // Diet
  diet_accepted_foods: string[];
  diet_live_food_required: boolean;
  diet_feeding_frequency: string;
  diet_notes: string;

  // Behavior
  behavior_temperament: string;
  behavior_recommended_sex_ratio: string;
  behavior_schooling: string;
  behavior_community_compatibility: string;
  behavior_notes: string;

  // Breeding
  breeding_spawning_mode: string;
  breeding_triggers: string;
  breeding_egg_count_typical: string;
  breeding_fry_care: string;
  breeding_survival_bottlenecks: string;
  breeding_notes: string;

  // Difficulty factors
  difficulty_adult_size: string;
  difficulty_space_demand: string;
  difficulty_temperament_challenge: string;
  difficulty_water_parameter_demand: string;
  difficulty_dietary_specialization: string;
  difficulty_breeding_complexity: string;
  difficulty_other: string;

  // Sourcing
  sourcing_cares_registered_breeders: boolean;
  sourcing_notes: string;

  // Narrative
  narrative: string;

  // Governance
  contributors: string;
  last_reviewed_by: HusbandryReviewer | null;
  last_reviewed_at: string | null;
  review_is_stale: boolean;

  // Sources
  sources: HusbandrySource[];
}

export type SpeciesHusbandryResult =
  | { kind: "ok"; data: SpeciesHusbandry }
  | { kind: "not_found" }
  | { kind: "error" };

export async function fetchSpeciesHusbandry(
  id: string | number,
): Promise<SpeciesHusbandryResult> {
  try {
    const data = await apiFetch<SpeciesHusbandry>(`/api/v1/species/${id}/husbandry/`);
    return { kind: "ok", data };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { kind: "not_found" };
    }
    return { kind: "error" };
  }
}

// 24 months, measured in days. Matches backend
// `husbandry.models.REVIEW_STALE_AFTER_DAYS` — reviews strictly OLDER than
// 730 days are stale; 730 days exactly is not yet stale (per AC-08.7).
export const REVIEW_STALE_AFTER_DAYS = 730;

/**
 * Client-side fallback computation of review staleness.
 *
 * The API returns `review_is_stale` as an authoritative value; prefer that
 * when it is present on the payload. This helper exists so the frontend can
 * still render a correct "review pending" note against fixtures, previews,
 * or future API shapes that omit the field.
 *
 * @param last_reviewed_at ISO date string (YYYY-MM-DD) or null
 * @param now Optional reference date (defaults to today) — injected for tests
 */
export function isReviewStale(
  last_reviewed_at: string | null,
  now: Date = new Date(),
): boolean {
  if (!last_reviewed_at) return true;
  const reviewed = new Date(`${last_reviewed_at}T00:00:00Z`);
  if (Number.isNaN(reviewed.getTime())) return true;
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.floor((nowUtc - reviewed.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > REVIEW_STALE_AFTER_DAYS;
}

// -----------------------------------------------------------------------------
// Pure logic exported for unit tests and component rendering.
// -----------------------------------------------------------------------------

export interface DifficultyFactor {
  key: string;
  label: string;
  value: string;
}

const DIFFICULTY_FACTOR_ORDER: Array<{ key: keyof SpeciesHusbandry; label: string }> = [
  { key: "difficulty_adult_size", label: "Adult size" },
  { key: "difficulty_space_demand", label: "Space demand" },
  { key: "difficulty_temperament_challenge", label: "Temperament challenge" },
  { key: "difficulty_water_parameter_demand", label: "Water parameter demand" },
  { key: "difficulty_dietary_specialization", label: "Dietary specialization" },
  { key: "difficulty_breeding_complexity", label: "Breeding complexity" },
  { key: "difficulty_other", label: "Other" },
];

/** Collect non-blank difficulty factors in display order (spec AC-09.5). */
export function collectDifficultyFactors(h: SpeciesHusbandry): DifficultyFactor[] {
  const out: DifficultyFactor[] = [];
  for (const { key, label } of DIFFICULTY_FACTOR_ORDER) {
    const v = h[key];
    if (typeof v === "string" && v.trim() !== "") {
      out.push({ key: String(key), label, value: v });
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Teaser variant selection — pure logic per spec "Visual treatment" lock.
// -----------------------------------------------------------------------------

export type TeaserVariant = "standard" | "emphasized";

export interface TeaserContext {
  has_husbandry: boolean;
  cares_status: string | null;
  shoal_priority: boolean;
}

export interface TeaserPresentation {
  render: boolean;
  variant: TeaserVariant;
  chipText: string | null; // null in standard variant
}

/**
 * Decide how the teaser should render for a species.
 *
 * Rules (from spec "Visual treatment — teaser block", locked 2026-04-18):
 * - Render iff `has_husbandry` is true.
 * - Emphasized when `cares_status` is a non-empty string OR `shoal_priority`.
 * - Chip reads "CARES + SHOAL priority" when BOTH are set, otherwise the
 *   single-flag phrase — never stack two chips.
 */
export function teaserPresentation(ctx: TeaserContext): TeaserPresentation {
  if (!ctx.has_husbandry) {
    return { render: false, variant: "standard", chipText: null };
  }
  const hasCares = typeof ctx.cares_status === "string" && ctx.cares_status.trim() !== "";
  const hasShoal = ctx.shoal_priority === true;
  if (!hasCares && !hasShoal) {
    return { render: true, variant: "standard", chipText: null };
  }
  let chipText: string;
  if (hasCares && hasShoal) {
    chipText = "CARES + SHOAL priority";
  } else if (hasCares) {
    chipText = "CARES breeder priority";
  } else {
    chipText = "SHOAL priority";
  }
  return { render: true, variant: "emphasized", chipText };
}

/**
 * Build the short teaser sentence for the CARES/SHOAL-emphasized variant
 * (copy from `docs/planning/copy/husbandry-platform-copy.md` §2 Variant A,
 * with single-flag rewrites per "Notes for implementation").
 */
export function teaserSentence(ctx: TeaserContext): string {
  const hasCares = typeof ctx.cares_status === "string" && ctx.cares_status.trim() !== "";
  const hasShoal = ctx.shoal_priority === true;
  if (hasCares && hasShoal) {
    return "A CARES / SHOAL priority species.";
  }
  if (hasCares) {
    return "A CARES priority species.";
  }
  if (hasShoal) {
    return "A SHOAL priority species.";
  }
  return "Guidance on keeping this species, drawn from keepers and published sources.";
}

/**
 * First-paragraph, whitespace-collapsed excerpt for meta description.
 * Truncates to ~160 chars on a word boundary, appends ellipsis if truncated.
 */
export function narrativeExcerpt(narrative: string, maxLen = 160): string {
  const collapsed = narrative.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLen) return collapsed;
  const cut = collapsed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > 40 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/[.,;:—\-]+$/, "")}…`;
}
