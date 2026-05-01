import { apiFetch } from "./api";

/**
 * Public field-programs fetcher for the unauthenticated `/field-programs/`
 * listing page. The API endpoint is public (no auth required) and is the
 * same route Tier-2 institution staff use for their dashboard, just
 * without an Authorization header.
 *
 * Cache discipline: this fetcher is consumed by a public, non-tier-aware
 * page so it reuses Next's default fetch cache. The page sets
 * `revalidate = 300` so a coordinator's edit is reflected within five
 * minutes without each request hammering Django.
 */

export type PublicFieldProgramStatus = "active" | "completed" | "planned";

export interface PublicFieldProgramRow {
  id: number;
  name: string;
  description: string;
  lead_institution: { id: number; name: string; country: string } | null;
  region: string;
  status: PublicFieldProgramStatus;
  start_date: string | null;
  end_date: string | null;
  funding_sources: string;
  website: string;
  focal_species: { id: number; scientific_name: string; iucn_status: string }[];
  partner_institutions: { id: number; name: string; country: string }[];
}

export interface PublicFieldProgramListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PublicFieldProgramRow[];
}

export async function fetchPublicFieldPrograms(): Promise<
  PublicFieldProgramListResponse | null
> {
  try {
    return await apiFetch<PublicFieldProgramListResponse>(
      "/api/v1/field-programs/",
    );
  } catch {
    return null;
  }
}


// ---------- Institution profile (public) ----------

export interface InstitutionProfileResponse {
  institution: {
    id: number;
    name: string;
    institution_type: string;
    country: string;
    city: string;
    website: string;
    zims_member: boolean;
    eaza_member: boolean;
    aza_member: boolean;
    contact_email?: string;
    species360_id?: string;
  };
  species_held: { id: number; scientific_name: string; iucn_status: string }[];
  populations_count: number;
  led_programs: { id: number; name: string; status: string }[];
  partner_programs: { id: number; name: string; status: string }[];
}

export async function fetchInstitutionProfile(
  id: number,
): Promise<InstitutionProfileResponse | null> {
  try {
    return await apiFetch<InstitutionProfileResponse>(
      `/api/v1/institutions/${id}/profile/`,
    );
  } catch {
    return null;
  }
}
