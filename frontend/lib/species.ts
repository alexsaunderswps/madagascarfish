import { apiFetch } from "./api";

export type IucnStatus = "CR" | "EN" | "VU" | "NT" | "LC" | "DD" | "NE";
export type TaxonomicStatus = "described" | "undescribed_morphospecies";
// Four-tier CARES plus the legacy priority/monitored tags. Filter rail uses
// the four-tier codes; card metadata row tolerates both (see SpeciesCard).
export type CaresStatus =
  | "CCR"
  | "CEN"
  | "CVU"
  | "CLC"
  | "priority"
  | "monitored"
  | "";
export type EndemicStatus = "endemic" | "native" | "introduced";

export interface CommonName {
  name: string;
  language: string;
}

export interface GenusBrief {
  name: string;
  has_silhouette: boolean;
}

export interface SpeciesListItem {
  id: number;
  scientific_name: string;
  taxonomic_status: TaxonomicStatus;
  provisional_name: string | null;
  family: string;
  genus: string;
  genus_fk: GenusBrief | null;
  endemic_status: EndemicStatus;
  iucn_status: IucnStatus | null;
  cares_status: CaresStatus | null;
  shoal_priority: boolean;
  common_names: CommonName[];
  silhouette_svg: string | null;
  primary_basin: string | null;
  locality_count: number;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SpeciesFilterState {
  search?: string;
  taxonomic_status?: TaxonomicStatus | "";
  iucn_status?: IucnStatus[];
  family?: string;
  cares_status?: CaresStatus;
  endemic_status?: EndemicStatus | "";
  shoal_priority?: "true" | "";
  has_cares?: "true" | "";
  has_captive_population?: "true" | "false" | "";
  // Introduced (exotic) species are hidden from the directory by default.
  // Flip to true to surface Oreochromis spp. and other invasives alongside the
  // native fauna. Absent / empty = default exclusion.
  include_introduced?: "true" | "";
  page?: number;
}

export type DirectoryDensity = "comfortable" | "compact";
export const DEFAULT_DENSITY: DirectoryDensity = "comfortable";

export function parseDensity(
  searchParams: Record<string, string | string[] | undefined>,
): DirectoryDensity {
  const raw = searchParams["d"];
  const val = Array.isArray(raw) ? raw[0] : raw;
  return val === "compact" ? "compact" : DEFAULT_DENSITY;
}

export const PAGE_SIZE = 50;

export const IUCN_STATUSES: IucnStatus[] = [
  "CR",
  "EN",
  "VU",
  "NT",
  "LC",
  "DD",
  "NE",
];

export const IUCN_LABELS: Record<IucnStatus, string> = {
  CR: "Critically Endangered",
  EN: "Endangered",
  VU: "Vulnerable",
  NT: "Near Threatened",
  LC: "Least Concern",
  DD: "Data Deficient",
  NE: "Not yet assessed",
};

export const KNOWN_FAMILIES: string[] = [
  "Bedotiidae",
  "Cichlidae",
  "Aplocheilidae",
  "Anchariidae",
  "Gobiidae",
  "Eleotridae",
];

export function buildSpeciesQuery(state: SpeciesFilterState): string {
  const params = new URLSearchParams();
  if (state.search) params.set("search", state.search);
  if (state.taxonomic_status) params.set("taxonomic_status", state.taxonomic_status);
  if (state.iucn_status && state.iucn_status.length > 0) {
    params.set("iucn_status", state.iucn_status.join(","));
  }
  if (state.family) params.set("family", state.family);
  if (state.cares_status) params.set("cares_status", state.cares_status);
  if (state.endemic_status) params.set("endemic_status", state.endemic_status);
  if (state.shoal_priority === "true") params.set("shoal_priority", "true");
  if (state.has_cares === "true") params.set("has_cares", "true");
  if (state.has_captive_population) {
    params.set("has_captive_population", state.has_captive_population);
  }
  if (state.include_introduced === "true") {
    params.set("include_introduced", "true");
  }
  if (state.page && state.page > 1) params.set("page", String(state.page));
  params.set("page_size", String(PAGE_SIZE));
  return params.toString();
}

export function parseSpeciesFilterState(
  searchParams: Record<string, string | string[] | undefined>,
): SpeciesFilterState {
  const get = (k: string): string | undefined => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const iucn = get("iucn_status");
  const pageRaw = get("page");
  const page = pageRaw ? Math.max(1, Number.parseInt(pageRaw, 10) || 1) : 1;
  return {
    search: get("search") ?? "",
    taxonomic_status: (get("taxonomic_status") as TaxonomicStatus | "" | undefined) ?? "",
    iucn_status: iucn
      ? (iucn.split(",").filter((s) => IUCN_STATUSES.includes(s as IucnStatus)) as IucnStatus[])
      : [],
    family: get("family") ?? "",
    cares_status: (get("cares_status") as CaresStatus | undefined) ?? "",
    endemic_status: (get("endemic_status") as EndemicStatus | "" | undefined) ?? "",
    shoal_priority: get("shoal_priority") === "true" ? "true" : "",
    has_cares: get("has_cares") === "true" ? "true" : "",
    has_captive_population:
      (get("has_captive_population") as "true" | "false" | "" | undefined) ?? "",
    include_introduced: get("include_introduced") === "true" ? "true" : "",
    page,
  };
}

export async function fetchSpeciesList(
  state: SpeciesFilterState,
): Promise<Paginated<SpeciesListItem>> {
  const query = buildSpeciesQuery(state);
  return apiFetch<Paginated<SpeciesListItem>>(`/api/v1/species/?${query}`);
}

const EMPTY_PAGE: Paginated<SpeciesListItem> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

export async function fetchSpeciesListSafe(
  state: SpeciesFilterState,
): Promise<Paginated<SpeciesListItem> | null> {
  try {
    return await fetchSpeciesList(state);
  } catch {
    return null;
  }
}

export { EMPTY_PAGE };
