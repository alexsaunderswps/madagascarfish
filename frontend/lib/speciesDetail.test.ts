import { describe, expect, it } from "vitest";

import {
  displayScientificName,
  fishbaseGenusSpeciesUrl,
  iucnRedListUrl,
  type SpeciesDetail,
} from "./speciesDetail";

function makeSp(overrides: Partial<SpeciesDetail> = {}): SpeciesDetail {
  return {
    id: 1,
    scientific_name: "Pachypanchax sakaramyi",
    taxonomic_status: "described",
    provisional_name: null,
    family: "Aplocheilidae",
    genus: "Pachypanchax",
    genus_fk: null,
    endemic_status: "endemic",
    iucn_status: "EN",
    cares_status: null,
    shoal_priority: false,
    authority: "Holly",
    year_described: 1928,
    description: "",
    ecology_notes: "",
    distribution_narrative: "",
    morphology: "",
    max_length_cm: null,
    silhouette_svg: "",
    habitat_type: "",
    iucn_taxon_id: 166478,
    common_names: [],
    primary_basin: null,
    locality_count: 0,
    conservation_assessments: [],
    field_programs: [],
    ex_situ_summary: { institutions_holding: 0, total_individuals: 0, breeding_programs: 0 },
    has_localities: false,
    has_husbandry: false,
    difficulty_factor_count: 0,
    ...overrides,
  };
}

describe("displayScientificName", () => {
  it("returns scientific_name for described species", () => {
    expect(displayScientificName(makeSp())).toBe("Pachypanchax sakaramyi");
  });

  it("returns genus + sp. + provisional_name for undescribed", () => {
    const sp = makeSp({
      scientific_name: "Bedotia sp. 'manombo'",
      taxonomic_status: "undescribed_morphospecies",
      provisional_name: "'manombo'",
      genus: "Bedotia",
    });
    expect(displayScientificName(sp)).toBe("Bedotia sp. 'manombo'");
  });
});

describe("iucnRedListUrl", () => {
  it("builds URL when taxon id is set", () => {
    expect(iucnRedListUrl(166478)).toBe("https://www.iucnredlist.org/species/166478/0");
  });

  it("returns null when taxon id is missing", () => {
    expect(iucnRedListUrl(null)).toBeNull();
  });
});

describe("fishbaseGenusSpeciesUrl", () => {
  it("builds URL for described species with binomial name", () => {
    const url = fishbaseGenusSpeciesUrl(makeSp());
    expect(url).toBe("https://www.fishbase.se/summary/Pachypanchax_sakaramyi.html");
  });

  it("returns null for undescribed morphospecies (sp. prefix)", () => {
    const sp = makeSp({
      scientific_name: "Bedotia sp. 'manombo'",
      taxonomic_status: "undescribed_morphospecies",
    });
    expect(fishbaseGenusSpeciesUrl(sp)).toBeNull();
  });
});
