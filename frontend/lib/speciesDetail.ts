import { ApiError, apiFetch } from "./api";
import type { CommonName, IucnStatus, SpeciesListItem } from "./species";

export interface ConservationAssessment {
  category: string;
  source: string;
  assessment_date: string | null;
  assessor: string;
  criteria: string;
}

export interface FieldProgramBrief {
  id: number;
  name: string;
  status: string;
}

export interface ExSituSummary {
  institutions_holding: number;
  total_individuals: number;
  breeding_programs: number;
}

export interface SpeciesDetail extends SpeciesListItem {
  authority: string | null;
  year_described: number | null;
  description: string;
  ecology_notes: string;
  distribution_narrative: string;
  morphology: string;
  max_length_cm: number | null;
  habitat_type: string;
  iucn_taxon_id: number | null;
  common_names: CommonName[];
  conservation_assessments: ConservationAssessment[];
  field_programs: FieldProgramBrief[];
  ex_situ_summary: ExSituSummary;
  has_localities: boolean;
  has_husbandry: boolean;
  iucn_status: IucnStatus | null;
}

export type SpeciesDetailResult =
  | { kind: "ok"; data: SpeciesDetail }
  | { kind: "not_found" }
  | { kind: "error" };

export async function fetchSpeciesDetail(id: string | number): Promise<SpeciesDetailResult> {
  try {
    const data = await apiFetch<SpeciesDetail>(`/api/v1/species/${id}/`);
    return { kind: "ok", data };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { kind: "not_found" };
    }
    return { kind: "error" };
  }
}

export function displayScientificName(sp: SpeciesDetail): string {
  if (sp.taxonomic_status === "undescribed_morphospecies" && sp.provisional_name) {
    return `${sp.genus} sp. ${sp.provisional_name}`;
  }
  return sp.scientific_name;
}

export function iucnRedListUrl(taxonId: number | null): string | null {
  if (!taxonId) return null;
  return `https://www.iucnredlist.org/species/${taxonId}/0`;
}

export function fishbaseGenusSpeciesUrl(sp: SpeciesDetail): string | null {
  if (!sp.genus || !sp.scientific_name) return null;
  const species = sp.scientific_name.split(" ")[1] ?? "";
  if (!species || species.startsWith("sp.") || species.startsWith("'")) return null;
  return `https://www.fishbase.se/summary/${encodeURIComponent(sp.genus)}_${encodeURIComponent(species)}.html`;
}
