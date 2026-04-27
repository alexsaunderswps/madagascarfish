import { apiFetch } from "./api";
import type { IucnStatus } from "./species";

export interface LocalityFeatureProperties {
  id: number;
  species_id: number;
  scientific_name: string;
  family: string;
  iucn_status: IucnStatus | null;
  locality_name: string;
  locality_type: string;
  presence_status: string;
  water_body: string;
  water_body_type: string;
  drainage_basin_name: string;
  year_collected: number | null;
  coordinate_precision: string;
  source_citation: string;
}

export interface LocalityFeature {
  type: "Feature";
  id?: number;
  geometry: { type: "Point"; coordinates: [number, number] } | null;
  properties: LocalityFeatureProperties;
}

export interface LocalityFeatureCollection {
  type: "FeatureCollection";
  features: LocalityFeature[];
}

export const IUCN_COLORS: Record<string, string> = {
  CR: "#d73027",
  EN: "#fc8d59",
  VU: "#fee08b",
  NT: "#d9ef8b",
  LC: "#91cf60",
  DD: "#9ca3af",
  NE: "#cbd5e1",
};

export function iucnColor(status: string | null | undefined): string {
  if (!status) return IUCN_COLORS.NE;
  return IUCN_COLORS[status] ?? IUCN_COLORS.NE;
}

export async function fetchLocalities(
  params: Record<string, string | number | undefined> = {},
  options: { authToken?: string } = {},
): Promise<LocalityFeatureCollection | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const path = qs.toString()
    ? `/api/v1/map/localities/?${qs.toString()}`
    : "/api/v1/map/localities/";
  try {
    // Gate 11: when called from a server component with a logged-in user,
    // pass `authToken` so the backend's tier gate sees Tier 3+ and serves
    // exact coordinates instead of generalized ones. Anonymous callers
    // (no token) get the existing public, generalized behavior.
    //
    // SECURITY: when an Authorization header is present, force
    // `revalidate: 0` so the user-specific (potentially exact-coordinate)
    // response is NEVER stored in Next's shared ISR cache and replayed to
    // a subsequent anonymous visitor. Anonymous calls keep the default
    // 1-hour ISR for performance.
    return await apiFetch<LocalityFeatureCollection>(path, {
      authToken: options.authToken,
      revalidate: options.authToken ? 0 : undefined,
    });
  } catch {
    return null;
  }
}
