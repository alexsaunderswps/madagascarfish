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
): Promise<LocalityFeatureCollection | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const path = qs.toString()
    ? `/api/v1/map/localities/?${qs.toString()}`
    : "/api/v1/map/localities/";
  try {
    return await apiFetch<LocalityFeatureCollection>(path);
  } catch {
    return null;
  }
}
