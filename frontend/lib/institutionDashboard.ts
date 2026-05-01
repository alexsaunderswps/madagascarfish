import { apiFetch } from "./api";

/**
 * Server-side fetchers for the Gate 13 institution dashboard.
 *
 * These calls hit the populations API on the user's behalf. The DRF
 * token never reaches the browser — pass `authToken` from
 * `getServerDrfToken()` and call only from server components / route
 * handlers.
 *
 * Cache discipline: `revalidate: 0` whenever a token is present.
 * Per-user (institution-scoped) responses must never enter Next's
 * shared ISR cache.
 */

export interface InstitutionPopulationRow {
  id: number;
  species: { id: number; scientific_name: string };
  institution: { id: number; name: string; country: string };
  count_total: number | null;
  count_male: number | null;
  count_female: number | null;
  count_unsexed: number | null;
  breeding_status: "breeding" | "non-breeding" | "unknown";
  studbook_managed: boolean;
  last_census_date: string | null;
}

export interface InstitutionPopulationListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InstitutionPopulationRow[];
}

export interface InstitutionPopulationDetail extends InstitutionPopulationRow {
  notes?: string;
  last_edited_at?: string | null;
  updated_at?: string | null;
}

// Deliberately no service-token fallback (unlike `coordinatorHeaders` in
// coordinatorDashboard.ts). Institution-scoped calls must authenticate as
// the actual user — the perm class reads `request.user.institution_id` to
// scope the query. A service token would bypass that and surface every
// institution's data to a Tier 2 caller.
function authHeaders(userDrfToken: string): HeadersInit {
  return { Authorization: `Token ${userDrfToken}` };
}

export async function fetchInstitutionPopulations(
  authToken: string,
): Promise<InstitutionPopulationListResponse | null> {
  try {
    return await apiFetch<InstitutionPopulationListResponse>(
      "/api/v1/populations/",
      {
        headers: authHeaders(authToken),
        revalidate: 0,
      },
    );
  } catch {
    return null;
  }
}

export async function fetchInstitutionPopulationDetail(
  id: number,
  authToken: string,
): Promise<InstitutionPopulationDetail | null> {
  try {
    return await apiFetch<InstitutionPopulationDetail>(
      `/api/v1/populations/${id}/`,
      {
        headers: authHeaders(authToken),
        revalidate: 0,
      },
    );
  } catch {
    return null;
  }
}

export interface UpdatePopulationPayload {
  count_total?: number | null;
  count_male?: number | null;
  count_female?: number | null;
  count_unsexed?: number | null;
  breeding_status?: "breeding" | "non-breeding" | "unknown";
  last_census_date?: string | null;
  notes?: string;
  studbook_managed?: boolean;
  _reason?: string;
}

export interface UpdatePopulationError {
  status: number;
  fieldErrors?: Record<string, string[]>;
  detail?: string;
}

export async function updateInstitutionPopulation(
  id: number,
  payload: UpdatePopulationPayload,
  authToken: string,
): Promise<{ ok: true } | { ok: false; error: UpdatePopulationError }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/populations/${id}/`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "PATCH",
      headers: {
        ...authHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      error: { status: 0, detail: err instanceof Error ? err.message : "network error" },
    };
  }
  if (resp.ok) return { ok: true };
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


// ---------- Gate 14: BreedingEvent ----------

export type BreedingEventType =
  | "spawning"
  | "hatching"
  | "mortality"
  | "acquisition"
  | "disposition"
  | "other";

export interface BreedingEventRow {
  id: number;
  population_id: number;
  species: { id: number; scientific_name: string };
  institution: { id: number; name: string };
  event_type: BreedingEventType;
  event_date: string;
  count_delta_male: number | null;
  count_delta_female: number | null;
  count_delta_unsexed: number | null;
  notes: string;
  reporter_email: string | null;
  created_at: string;
}

export interface BreedingEventListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: BreedingEventRow[];
}

export async function fetchBreedingEvents(
  authToken: string,
): Promise<BreedingEventListResponse | null> {
  try {
    return await apiFetch<BreedingEventListResponse>("/api/v1/breeding-events/", {
      headers: authHeaders(authToken),
      revalidate: 0,
    });
  } catch {
    return null;
  }
}

export interface CreateBreedingEventPayload {
  population: number;
  event_type: BreedingEventType;
  event_date: string;
  count_delta_male?: number | null;
  count_delta_female?: number | null;
  count_delta_unsexed?: number | null;
  notes?: string;
}

export interface CreateBreedingEventError {
  status: number;
  fieldErrors?: Record<string, string[]>;
  detail?: string;
}

export async function createBreedingEvent(
  payload: CreateBreedingEventPayload,
  authToken: string,
): Promise<{ ok: true } | { ok: false; error: CreateBreedingEventError }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/breeding-events/`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { ...authHeaders(authToken), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      error: { status: 0, detail: err instanceof Error ? err.message : "network error" },
    };
  }
  if (resp.ok) return { ok: true };
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


// ---------- Aggregate panel ----------

export interface InstitutionSummaryRow {
  species: { id: number; scientific_name: string; iucn_status: string | null };
  this_institution_count: number;
  global_count: number;
  share_pct: number;
  institutions_holding: number;
  recent_breeding_events: number;
}

export interface InstitutionSummaryResponse {
  institution: { id: number; name: string };
  totals: {
    populations: number;
    species: number;
    breeding_events_last_12_months: number;
    fresh_census_count: number;
    stale_census_count: number;
  };
  species_breakdown: InstitutionSummaryRow[];
}

export async function fetchInstitutionSummary(
  authToken: string,
): Promise<InstitutionSummaryResponse | null> {
  try {
    return await apiFetch<InstitutionSummaryResponse>(
      "/api/v1/institution-summary/",
      {
        headers: authHeaders(authToken),
        revalidate: 0,
      },
    );
  } catch {
    return null;
  }
}
