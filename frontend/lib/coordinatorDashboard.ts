import { apiFetch } from "./api";

/**
 * Server-side fetchers for the four Gate 3 coordinator dashboard panels.
 *
 * These endpoints gate on Tier 3+ (or the COORDINATOR_API_TOKEN service
 * bypass). Call these only from server components / route handlers —
 * the token must never reach the browser.
 */

// ---------- Panel 1: Coverage gap ----------

export interface CoverageGapRow {
  species_id: number;
  scientific_name: string;
  genus: string;
  family: string;
  iucn_status: string;
  endemic_status: string;
  population_trend: string | null;
  cares_status: string | null;
  shoal_priority: boolean;
}

export interface CoverageGapResponse {
  endemic_only: boolean;
  total: number;
  results: CoverageGapRow[];
  data_deficient: {
    total: number;
    endemic_count: number;
  };
}

// ---------- Panel 2: Studbook status ----------

export interface StudbookSpeciesRow {
  species_id: number;
  scientific_name: string;
  population_count: number;
}

export interface StudbookBucket {
  count: number;
  species?: StudbookSpeciesRow[];
}

export interface StudbookStatusResponse {
  buckets: {
    studbook_managed: StudbookBucket;
    breeding_not_studbook: StudbookBucket;
    holdings_only: StudbookBucket;
    no_captive_population: StudbookBucket;
  };
}

// ---------- Panel 3: Sex-ratio risk ----------

export interface SexRatioRiskRow {
  population_id: number;
  species: { id: number; scientific_name: string };
  institution: { id: number; name: string };
  mfu: string;
  count_total: number | null;
  risk_reasons: string[];
}

export interface SexRatioRiskResponse {
  total_populations: number;
  total_at_risk: number;
  thresholds: {
    max_skew_ratio: number;
    unsexed_fraction_threshold: number;
  };
  results: SexRatioRiskRow[];
}

// ---------- Panel 4: Stale census ----------

export interface StaleCensusRow {
  population_id: number;
  species: { id: number; scientific_name: string };
  institution: { id: number; name: string };
  last_census_date: string | null;
  most_recent_holding_record_date: string | null;
  effective_last_update: string | null;
  days_since_update: number | null;
}

export interface StaleCensusResponse {
  threshold_months: number;
  reference_date: string;
  total_populations: number;
  total_stale: number;
  results: StaleCensusRow[];
}

// ---------- Shared fetch helpers ----------

function coordinatorHeaders(): HeadersInit {
  const token = process.env.COORDINATOR_API_TOKEN;
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

/**
 * Server-side check: is the coordinator token wired up?
 *
 * Returns false in two cases we want to distinguish visually from an
 * upstream error — a blank-dashboard rendered with a silent 403 cascade
 * is indistinguishable from "the data just isn't there yet," which
 * masks a misconfigured Vercel env. The page uses this to render an
 * operator-facing banner instead of four identical fallback states.
 */
export function isCoordinatorTokenConfigured(): boolean {
  return Boolean(process.env.COORDINATOR_API_TOKEN);
}

async function fetchCoordinator<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path, { headers: coordinatorHeaders() });
  } catch {
    return null;
  }
}

export function fetchCoverageGap(
  options: { endemicOnly?: boolean } = {},
): Promise<CoverageGapResponse | null> {
  const params = new URLSearchParams();
  if (options.endemicOnly === false) {
    params.set("endemic_only", "false");
  }
  const qs = params.toString();
  const path = `/api/v1/coordinator-dashboard/coverage-gap/${qs ? `?${qs}` : ""}`;
  return fetchCoordinator<CoverageGapResponse>(path);
}

export function fetchStudbookStatus(): Promise<StudbookStatusResponse | null> {
  return fetchCoordinator<StudbookStatusResponse>(
    "/api/v1/coordinator-dashboard/studbook-status/",
  );
}

export function fetchSexRatioRisk(): Promise<SexRatioRiskResponse | null> {
  return fetchCoordinator<SexRatioRiskResponse>(
    "/api/v1/coordinator-dashboard/sex-ratio-risk/",
  );
}

export function fetchStaleCensus(): Promise<StaleCensusResponse | null> {
  return fetchCoordinator<StaleCensusResponse>(
    "/api/v1/coordinator-dashboard/stale-census/",
  );
}
