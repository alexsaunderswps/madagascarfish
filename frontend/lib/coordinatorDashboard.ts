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

export interface LastEditedByBlock {
  kind: "institution" | "coordinator";
  at: string;
  institution_name: string | null;
}

export interface StaleCensusRow {
  population_id: number;
  species: { id: number; scientific_name: string };
  institution: { id: number; name: string };
  last_census_date: string | null;
  most_recent_holding_record_date: string | null;
  effective_last_update: string | null;
  days_since_update: number | null;
  last_edited_by: LastEditedByBlock | null;
}

export interface StaleCensusResponse {
  threshold_months: number;
  reference_date: string;
  total_populations: number;
  total_stale: number;
  results: StaleCensusRow[];
}

// ---------- Panel 5: Transfer activity (Gate 4 Phase 1) ----------

export type TransferStatus =
  | "proposed"
  | "approved"
  | "in_transit"
  | "completed"
  | "cancelled";

export interface TransferRow {
  transfer_id: number;
  species: { id: number; scientific_name: string };
  source_institution: { id: number; name: string };
  destination_institution: { id: number; name: string };
  status: TransferStatus;
  proposed_date: string | null;
  planned_date: string | null;
  actual_date: string | null;
  count_male: number | null;
  count_female: number | null;
  count_unsexed: number | null;
  cites_reference: string | null;
  coordinated_program_id: number | null;
}

export interface TransferActivityResponse {
  window_days: number;
  reference_date: string;
  in_flight_count: number;
  recent_completed_count: number;
  in_flight: TransferRow[];
  recent_completed: TransferRow[];
}

// ---------- Panel 6: Open breeding recommendations (Gate 4 Phase 2) ----------

export type RecommendationType = "breed" | "non_breed" | "transfer" | "other";
export type RecommendationPriority = "critical" | "high" | "medium" | "low";
export type RecommendationStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "superseded"
  | "cancelled";

export interface OpenRecommendationRow {
  recommendation_id: number;
  species: { id: number; scientific_name: string };
  recommendation_type: RecommendationType;
  priority: RecommendationPriority;
  status: RecommendationStatus;
  issued_date: string | null;
  due_date: string | null;
  coordinated_program_id: number | null;
  source_population_id: number | null;
  target_institution: { id: number; name: string } | null;
  rationale: string;
}

export interface OpenRecommendationsResponse {
  reference_date: string;
  total_open: number;
  overdue_count: number;
  results: OpenRecommendationRow[];
}

// ---------- Panel 7: Recent reproductive activity (Gate 4 Phase 3) ----------

export type BreedingEventType =
  | "spawning"
  | "hatching"
  | "mortality"
  | "acquisition"
  | "disposition"
  | "other";

export interface BreedingEventRow {
  event_id: number;
  event_type: BreedingEventType;
  event_date: string | null;
  population: {
    id: number;
    species: { id: number; scientific_name: string };
    institution: { id: number; name: string };
  };
  count_delta_male: number | null;
  count_delta_female: number | null;
  count_delta_unsexed: number | null;
  notes: string;
}

export interface BreedingEventBucket {
  count: number;
  recent_species: string[];
}

export interface ReproductiveActivityResponse {
  window_days: number;
  reference_date: string;
  total_events: number;
  result_limit: number;
  by_event_type: Record<BreedingEventType, BreedingEventBucket>;
  results: BreedingEventRow[];
}

// ---------- Shared fetch helpers ----------

/**
 * Auth source for the coordinator dashboard SSR fetches (Gate 11).
 *
 * Resolution order:
 *   1. `userDrfToken` — the logged-in coordinator's DRF token, pulled from
 *      the NextAuth session by the page's server component. Sent as
 *      `Authorization: Token <key>` so the backend evaluates the user's tier.
 *   2. `process.env.COORDINATOR_API_TOKEN` — service-token bypass. Used when
 *      no user session is available (anonymous SSR, NextAuth disabled, or
 *      session retrieval failed). Sent as `Authorization: Bearer <token>`,
 *      matching the existing `TierOrServiceTokenPermission` branch.
 *   3. Neither — no Authorization header. The endpoint will 403 and the
 *      panel renders the existing "token not configured" banner.
 *
 * Session-first / service-token-fallback is locked in
 * `docs/planning/specs/gate-11-auth-mvp.md` §6 and BA Story 5.
 */
function coordinatorHeaders(userDrfToken?: string): HeadersInit {
  if (userDrfToken) {
    // Server-side log — appears in Vercel function logs. Confirms the
    // session-first path is being taken and not silently falling back to
    // the service token. Token value is never logged. See OPERATIONS.md
    // §11.4 for the cookie-domain verification flow this supports.
    console.log("[coordinator-auth] path=session");
    return { Authorization: `Token ${userDrfToken}` };
  }
  const serviceToken = process.env.COORDINATOR_API_TOKEN;
  if (serviceToken) {
    console.log("[coordinator-auth] path=service-token-fallback");
    return { Authorization: `Bearer ${serviceToken}` };
  }
  console.log("[coordinator-auth] path=none");
  return {};
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

async function fetchCoordinator<T>(path: string, userDrfToken?: string): Promise<T | null> {
  try {
    // revalidate: 0 bypasses Next.js's fetch cache for these responses.
    // Coordinator panels surface population-level detail at an identifiable
    // institution; caching the response in Next's shared fetch cache (default
    // 1h via apiFetch) would let the same payload be replayed to subsequent
    // SSR requests without re-authenticating upstream. Hit Django every time.
    return await apiFetch<T>(path, {
      headers: coordinatorHeaders(userDrfToken),
      revalidate: 0,
    });
  } catch {
    return null;
  }
}

// All seven coordinator fetchers take the same options shape so the next
// person adding one doesn't have to remember which is positional vs
// object. Match `apiFetch`'s style. Declared above the first fetcher
// (fetchCoverageGap) so the base type is visible before any extension.
export interface CoordinatorFetchOptions {
  authToken?: string;
}

export function fetchCoverageGap(
  options: CoordinatorFetchOptions & { endemicOnly?: boolean } = {},
): Promise<CoverageGapResponse | null> {
  const params = new URLSearchParams();
  if (options.endemicOnly === false) {
    params.set("endemic_only", "false");
  }
  const qs = params.toString();
  const path = `/api/v1/coordinator-dashboard/coverage-gap/${qs ? `?${qs}` : ""}`;
  return fetchCoordinator<CoverageGapResponse>(path, options.authToken);
}

export function fetchStudbookStatus(
  options: CoordinatorFetchOptions = {},
): Promise<StudbookStatusResponse | null> {
  return fetchCoordinator<StudbookStatusResponse>(
    "/api/v1/coordinator-dashboard/studbook-status/",
    options.authToken,
  );
}

export function fetchSexRatioRisk(
  options: CoordinatorFetchOptions = {},
): Promise<SexRatioRiskResponse | null> {
  return fetchCoordinator<SexRatioRiskResponse>(
    "/api/v1/coordinator-dashboard/sex-ratio-risk/",
    options.authToken,
  );
}

export function fetchStaleCensus(
  options: CoordinatorFetchOptions = {},
): Promise<StaleCensusResponse | null> {
  return fetchCoordinator<StaleCensusResponse>(
    "/api/v1/coordinator-dashboard/stale-census/",
    options.authToken,
  );
}

export function fetchTransferActivity(
  options: CoordinatorFetchOptions = {},
): Promise<TransferActivityResponse | null> {
  return fetchCoordinator<TransferActivityResponse>(
    "/api/v1/coordinator-dashboard/transfer-activity/",
    options.authToken,
  );
}

export function fetchOpenRecommendations(
  options: CoordinatorFetchOptions = {},
): Promise<OpenRecommendationsResponse | null> {
  return fetchCoordinator<OpenRecommendationsResponse>(
    "/api/v1/coordinator-dashboard/open-recommendations/",
    options.authToken,
  );
}

export function fetchReproductiveActivity(
  options: CoordinatorFetchOptions = {},
): Promise<ReproductiveActivityResponse | null> {
  return fetchCoordinator<ReproductiveActivityResponse>(
    "/api/v1/coordinator-dashboard/reproductive-activity/",
    options.authToken,
  );
}


// ---------- Transfer drafts (Tier 3+ write surface) ----------

export type TransferStatusValue =
  | "proposed"
  | "approved"
  | "in_transit"
  | "completed"
  | "cancelled";

export interface TransferDetailRow {
  id: number;
  species: { id: number; scientific_name: string; iucn_status: string };
  source_institution: { id: number; name: string; country: string };
  destination_institution: { id: number; name: string; country: string };
  status: TransferStatusValue;
  proposed_date: string;
  planned_date: string | null;
  actual_date: string | null;
  count_male: number | null;
  count_female: number | null;
  count_unsexed: number | null;
  cites_reference: string;
  notes: string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TransferDetailRow[];
}

export async function fetchTransferDrafts(
  authToken: string,
): Promise<TransferListResponse | null> {
  try {
    return await apiFetch<TransferListResponse>("/api/v1/transfers/", {
      headers: coordinatorHeaders(authToken),
      revalidate: 0,
    });
  } catch {
    return null;
  }
}

export interface TransferWritePayload {
  species?: number;
  source_institution?: number;
  destination_institution?: number;
  status?: TransferStatusValue;
  proposed_date?: string;
  planned_date?: string | null;
  actual_date?: string | null;
  count_male?: number | null;
  count_female?: number | null;
  count_unsexed?: number | null;
  cites_reference?: string;
  notes?: string;
}

export interface TransferWriteError {
  status: number;
  fieldErrors?: Record<string, string[]>;
  detail?: string;
}

async function _transferWrite(
  method: "POST" | "PATCH",
  path: string,
  payload: TransferWritePayload,
  authToken: string,
): Promise<{ ok: true; id?: number } | { ok: false; error: TransferWriteError }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method,
      headers: { ...coordinatorHeaders(authToken), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      error: { status: 0, detail: err instanceof Error ? err.message : "network error" },
    };
  }
  if (resp.ok) {
    let id: number | undefined;
    try {
      const body = (await resp.json()) as { id?: number };
      id = typeof body.id === "number" ? body.id : undefined;
    } catch {
      /* no body */
    }
    return { ok: true, id };
  }
  let body: unknown = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }
  const fieldErrors: Record<string, string[]> = {};
  let detail: string | undefined;
  if (body && typeof body === "object") {
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (k === "detail" && typeof v === "string") {
        detail = v;
        continue;
      }
      if (Array.isArray(v)) {
        fieldErrors[k] = v.filter((item): item is string => typeof item === "string");
      } else if (typeof v === "string") {
        fieldErrors[k] = [v];
      }
    }
  }
  return {
    ok: false,
    error: {
      status: resp.status,
      fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
      detail,
    },
  };
}

export function createTransferDraft(payload: TransferWritePayload, authToken: string) {
  return _transferWrite("POST", "/api/v1/transfers/", payload, authToken);
}

export function updateTransferDraft(
  id: number,
  payload: TransferWritePayload,
  authToken: string,
) {
  return _transferWrite("PATCH", `/api/v1/transfers/${id}/`, payload, authToken);
}
