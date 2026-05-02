# Malagasy Freshwater Fishes Conservation Platform: Complete Reference Library

This document compiles the full bibliographic, technical, and institutional reference base for the Malagasy Freshwater Fishes Conservation Platform. It serves two audiences simultaneously: **conservation professionals** who need peer-reviewed citations, institutional contacts, and framework documentation, and **developers** who need API endpoints, data schemas, and technical specifications. Every entry includes a full citation, URL, and annotation explaining its relevance to the platform.

---

## 1. Core peer-reviewed literature

### Foundational platform references

**Leiss, L., Rauhaus, A., Rakotoarison, A., Fusari, C., Vences, M., & Ziegler, T. (2022).** Review of threatened Malagasy freshwater fishes in zoos and aquaria: The necessity of an ex situ conservation network—A call for action. *Zoo Biology*, 41(3), 244–262. https://doi.org/10.1002/zoo.21661
- **Access:** Open access (CC BY-NC-ND 4.0); PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC9299897/
- **Annotation:** **THE foundational paper for this platform.** Surveyed all 173 fish species from Malagasy freshwater habitats, identifying 123 exclusively freshwater species, 79 endemics, and 50 threatened species. Found only 21 species in zoos worldwide (19 endemic and threatened), with just 9 reproducing recently. Identified **31 threatened endemics not held ex situ at all**. Supplementary tables provide the baseline dataset for the platform's species inventory, threat prioritization, and institutional holdings tracking. Data sourced from ZIMS and Zootierliste.

**Ziegler, T., Frank-Klein, N., Ommer, S., Hürche, R., & Vences, M. (2020).** Husbandry and captive breeding of imperiled endemic Malagasy freshwater fishes at Cologne Zoo: A contribution towards the advancement of a conservation breeding network. *Der Zoologische Garten N.F.*, 88, 123–155.
- **Access:** Available via Elsevier/ScienceDirect (institutional access may be required)
- **Annotation:** Detailed husbandry protocols for five threatened species bred at Cologne Zoo: *Pachypanchax sakaramyi* (EN), *Bedotia madagascariensis* (EN), *Rheocles vatosoa* (EN), *Ptychochromis insolitus* (CR), and *P. loisellei* (EN). Includes DNA barcoding (16S rRNA) of all nine endemic species held at Cologne Zoo for identity confirmation. Provides the operational blueprint for the ex-situ breeding network and data fields the platform should capture for husbandry records.

**Vences, M., Stützer, D., Rasoamampionona Raminosoa, N., & Ziegler, T. (2022).** Towards a DNA barcode library for Madagascar's threatened ichthyofauna. *PLoS ONE*, 17(8), e0271400. https://doi.org/10.1371/journal.pone.0271400
- **Access:** Open access (CC BY 4.0); PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC9371263/; Zenodo data deposit: https://zenodo.org/records/6792379
- **Annotation:** Curated database of **2,860 mitochondrial sequences** (COI, 16S, ND2) for Malagasy fishes, with 1,141 freshwater sequences newly generated. Establishes the molecular reference library essential for eDNA survey interpretation and captive stock identity verification. The Zenodo deposit contains the complete barcode library in XLSX and FASTA formats — a key data source the platform should ingest for species-level molecular matching.

**Oliveira Carvalho, C., Pazirgiannidi, M., Ravelomanana, T., Andriambelomanana, F., Schrøder-Nielsen, A., Ready, J. S., de Boer, H., Fusari, C.-E., & Mauvisseau, Q. (2024).** Multi-method survey rediscovers critically endangered species and strengthens Madagascar's freshwater fish conservation. *Scientific Reports*, 14, 20427. https://doi.org/10.1038/s41598-024-71398-z
- **Access:** Open access; PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC11372049/
- **Annotation:** Combined eDNA metabarcoding with traditional fishing in the Amboaboa River basin (Sofia drainage). **Rediscovered *Rheocles derhami*** (last recorded 2013) and confirmed persistence of *Ptychochromis insolitus* (N=4), *Paretroplus gymnopreopercularis* (N=1), and *P. nourissati* (N=37). eDNA detected only a fraction of species found by traditional methods, highlighting reference database gaps. Demonstrates the multi-method survey workflow the platform should support and the Fish Net Madagascar program's field operations.

### Conservation assessments and overviews

**Benstead, J. P., de Rham, P. H., Gattolliat, J.-L., Gibon, F.-M., Loiselle, P. V., Sartori, M., Sparks, J. S., & Stiassny, M. L. J. (2003).** Conserving Madagascar's freshwater biodiversity. *BioScience*, 53(11), 1101–1111. https://doi.org/10.1641/0006-3568(2003)053[1101:CMFB]2.0.CO;2
- **Access:** Institutional access or BioOne
- **Annotation:** The seminal call to action for Madagascar freshwater conservation. Documented the crisis across fish, invertebrates, and aquatic habitats, established that ex-situ breeding was already the only reliable means to save many species, and set the agenda followed by all subsequent work. Essential historical baseline for the platform's conservation narrative.

**Máiz-Tomé, L., Sayer, C., & Darwall, W. (Eds.). (2018).** *The status and distribution of freshwater biodiversity in Madagascar and the Indian Ocean islands hotspot.* IUCN, Gland, Switzerland. viii+128pp. https://doi.org/10.2305/IUCN.CH.2018.RA.1.en
- **Access:** Open access PDF: https://portals.iucn.org/library/sites/library/files/documents/RL-2018-001.pdf
- **Annotation:** The authoritative IUCN regional assessment. Covers status, distribution, and threats for all freshwater taxa in Madagascar. Chapter by Ravelomanana et al. (pp. 13–28) specifically addresses freshwater fish status and distribution. Contains spatial distribution data and threat assessments that form the IUCN data layer for the platform. Found **43% of freshwater species in the hotspot are threatened**.

**Goodman, S. M., & Benstead, J. P. (Eds.). (2003).** *The natural history of Madagascar.* University of Chicago Press, Chicago. 1709 pp. ISBN: 978-0226303079.
- **Access:** Print/institutional library; individual chapters available through academic databases
- **Annotation:** The landmark comprehensive reference on Madagascar's biota. Contains key fish chapters: Sparks & Stiassny (2003) "Introduction to the freshwater fishes" (pp. 849–863) and Loiselle (2003) on captive breeding (below). The 2022 updated edition (*The New Natural History of Madagascar*, Princeton University Press) includes Sparks & Stiassny's revised chapter (pp. 1245–1260).

**Loiselle, P. V. (2003).** Captive breeding for freshwater fishes of Madagascar. In S. M. Goodman & J. P. Benstead (Eds.), *The natural history of Madagascar* (pp. 1569–1579). University of Chicago Press.
- **Access:** Print/institutional library
- **Annotation:** First systematic argument for conservation breeding of Madagascar's freshwater fish. Identified priority species and breeding strategies that remain relevant today. Loiselle's work laid the conceptual foundation for the CARES Priority List and the institutional breeding networks the platform tracks.

**Wilmé, L., Goodman, S. M., & Ganzhorn, J. U. (2006).** Biogeographic evolution of Madagascar's microendemic biota. *Science*, 312(5776), 1063–1065. https://doi.org/10.1126/science.1122806
- **Access:** Institutional access via Science/AAAS
- **Annotation:** Proposed the watershed hypothesis explaining microendemism via river catchments and Quaternary climatic shifts. Low-elevation catchments served as zones of isolation and speciation — directly explaining why many freshwater fish are single-drainage endemics. Essential for the platform's biogeographic context and watershed-based conservation planning features.

### Taxonomic revisions

**Stiassny, M. L. J., & Sparks, J. S. (2006).** Phylogeny and taxonomic revision of the endemic Malagasy genus *Ptychochromis* (Teleostei: Cichlidae), with the description of five new species and a diagnosis for *Katria*, new genus. *American Museum Novitates*, 3535, 1–55. https://doi.org/10.1206/0003-0082(2006)3535[1:PATROT]2.0.CO;2
- **Access:** Open access via AMNH Digital Library
- **Annotation:** Described five new *Ptychochromis* species and erected *Katria* as a new genus. This revision defines the taxonomic units that the platform must track for Madagascar's most threatened cichlid lineage, including the critically endangered *P. insolitus*.

**Sparks, J. S., & Stiassny, M. L. J. (2003).** Introduction to the freshwater fishes. In S. M. Goodman & J. P. Benstead (Eds.), *The natural history of Madagascar* (pp. 849–863). University of Chicago Press.
- **Access:** Print/institutional library
- **Annotation:** Foundational overview of Madagascar's freshwater fish diversity, biogeography, and conservation status as of 2003. Establishes the family-level taxonomy (Bedotiidae, Cichlidae/Ptychochrominae, Aplocheilidae, Anchariidae) that structures the platform's species hierarchy.

**Sparks, J. S. (2004).** Molecular phylogeny and biogeography of the Malagasy and South Asian cichlids (Teleostei: Perciformes: Cichlidae). *Molecular Phylogenetics and Evolution*, 30(3), 599–614. https://doi.org/10.1016/S1055-7903(03)00225-2
- **Access:** Institutional access via Elsevier
- **Annotation:** Established the two subfamilies within Malagasy–South Asian cichlids: Etroplinae (*Paretroplus* + *Etroplus*) and Ptychochrominae (*Ptychochromis*, *Ptychochromoides*, *Oxylapia*). Defines the phylogenetic framework the platform uses for the cichlid lineages.

**Sparks, J. S., & Smith, W. L. (2004).** Phylogeny and biogeography of cichlid fishes (Teleostei: Perciformes: Cichlidae). *Cladistics*, 20(6), 501–517. https://doi.org/10.1111/j.1096-0031.2004.00038.x
- **Access:** Institutional access via Wiley
- **Annotation:** Broader cichlid phylogeny placing Madagascar's endemic lineages in global context. Relevant for the platform's taxonomic hierarchy and understanding evolutionary distinctiveness for EDGE scoring.

**Ng, H. H., & Sparks, J. S. (2005).** Revision of the endemic Malagasy catfish family Anchariidae (Teleostei: Siluriformes), with descriptions of a new genus and three new species. *Ichthyological Exploration of Freshwaters*, 16(4), 303–323.
- **Access:** Institutional access
- **Annotation:** Formally established Anchariidae as a family (previously within Ariidae) and erected the genus *Gogo*. Defines the taxonomic framework for Madagascar's endemic catfishes, a priority group for the platform's species inventory.

**Ng, H. H., & Sparks, J. S. (2003).** The ariid catfishes (Teleostei: Siluriformes: Ariidae) of Madagascar, with the description of two new species. *Occasional Papers of the Museum of Zoology, University of Michigan*, 735, 1–21.
- **Access:** University of Michigan Digital Library
- **Annotation:** Described two new ariid species from Madagascar. Relevant for correctly classifying Madagascar's catfish diversity and distinguishing Ariidae (partially marine/brackish) from the purely freshwater Anchariidae in the platform's species filters.

### Newly described species (2023–2025)

**Carr, E. M., Martin, R. P., & Sparks, J. S. (2024).** A new extinct species of *Malagodon* (Cyprinodontiformes: Pantanodontidae) from southeastern coastal Madagascar, with a discussion of its phylogenetic relationships and a redescription of the genus. *American Museum Novitates*, 4012, 1–16. https://doi.org/10.1206/4012.1
- **Access:** Open access via BioOne: https://bioone.org/journals/american-museum-novitates/volume-2024/issue-4012/
- **Annotation:** Described *Malagodon honahona* from Réserve Spéciale de Manombo — **presumed extinct** (last collected late 1990s). Distinguished from its only congener *M. madagascariensis* by lower anal-fin ray count and longer caudal peduncle. The platform must track this species with EX or EW status. Also provides the definitive redescription of *Malagodon* following the genus reassignment from *Pantanodon*.

**Sparks, J. S., & Sparks, E. E. (2025).** A new species of *Paretroplus* (Teleostei: Cichlidae: Etroplinae) from northwestern Madagascar, with a discussion of its relationships within the *P. damii* clade. *Miscellaneous Publications, Museum of Zoology, University of Michigan*, 209(4), 1–22.
- **Access:** University of Michigan Deep Blue: https://deepblue.lib.umich.edu/items/fae38716-9755-4d7d-a9d8-2a8f87b24e4d
- **Annotation:** Described *Paretroplus risengi* from the Anjingo-Ankofia drainage (including Lake Andrapongy), raising the genus to **14 recognized species**. Named for limnologist Karen J. Riseng. Still maintains healthy populations in parts of its range. The platform must add this species to the *Paretroplus* inventory and assess its ex-situ need.

**Meinema, E., & Huber, J. H. (2023).** Review of Pantanodontidae (Cyprinodontiformes) and its fossil and extant genera *Pantanodon* Myers, 1955 and †*Paralebias* Gaudant, 2013 with descriptions of two new recent genera and five new species. *Killi-Data Series 2023*, 21–73. ISBN: 978-2-9547546-4-2.
- **Access:** https://www.killi-data.org/series-kd-2023-Meinema_Huber.php (PDF available for purchase)
- **Annotation:** **The key Pantanodon → Malagodon reassignment paper.** Split Pantanodontidae into four genera: *Pantanodon* (Tanzania), *Malagodon* nov. gen. (Madagascar), *Aliteranodon* nov. gen. (Kenya/Tanzania), and †*Paralebias* (fossil). Only *Malagodon* is endemic to Madagascar. Critical for the platform's taxonomic authority — all former "*Pantanodon madagascariensis*" records must be updated to *Malagodon madagascariensis*.

**Bragança, P. H. N., Amorim, P. F., & Costa, W. J. E. M. (2018).** Pantanodontidae (Teleostei, Cyprinodontiformes), the sister group to all other cyprinodontoid killifishes as inferred by molecular data. *Zoosystematics and Evolution*, 94(1), 137–145. https://doi.org/10.3897/zse.94.22173
- **Access:** Open access: https://zse.pensoft.net/article/22173/
- **Annotation:** Molecular phylogeny underlying the family-level recognition of Pantanodontidae. Establishes the deep evolutionary distinctiveness of the lineage containing *Malagodon* — relevant for EDGE score calculations in the platform.

### Rediscovery and recent survey literature

**Re:wild. (2024).** Giant millipede lost to science for more than a century and 20 other species rediscovered in Madagascar during first-of-its-kind expedition [Press release]. https://www.rewild.org/press/lost-species-rediscovered-in-Madagascar-2024
- **Access:** Open access
- **Annotation:** Reports the Search for Lost Species expedition to Makira Forest Protected Area (Aug–Sept 2023) which found 21 species lost to science, including **three undescribed iridescent freshwater fish species**. These unnamed species will need platform entries once formally described.

---

## 2. Taxonomic and biodiversity databases

### IUCN Red List API

- **Main portal:** https://www.iucnredlist.org/
- **API v4 (current):** https://api.iucnredlist.org/
- **API documentation (Swagger):** https://api.iucnredlist.org/api-docs/index.html
- **API key signup:** https://api.iucnredlist.org/users/sign_up
- **Authentication:** Free API token required (register, agree to Terms of Use)
- **Data format:** JSON
- **Rate limits:** 2-second delay between calls recommended
- **R client:** `rredlist` (rOpenSci) — https://docs.ropensci.org/rredlist/
- **Note:** API v3 (formerly at apiv3.iucnredlist.org) was **shut down ~March 2025**. All platform code must use v4.
- **Key endpoints:** Species lookup, assessments by taxon, comprehensive groups, country-level species lists, habitats, threats, conservation actions
- **Annotation:** Primary source for conservation status (CR, EN, VU, etc.), population trends, threats, and habitat data for all Malagasy freshwater fish. The platform should query v4 programmatically for status updates and display Red List categories alongside species profiles.

### FishBase

- **Main website:** https://www.fishbase.org/
- **Current API (S3-based):** https://fishbase.ropensci.org/fishbase (Parquet files via S3-compatible REST)
- **Legacy REST API (deprecated):** https://fishbaseapi.readme.io/
- **R package:** `rfishbase` v4.0+ (rOpenSci) — https://docs.ropensci.org/rfishbase/
- **Authentication:** None required (open access)
- **Data format:** Parquet files (current); JSON (legacy)
- **Tables available:** Species, ecology, distribution, morphology, reproduction, food items, genetics, country lists, synonyms (~60+ tables)
- **Annotation:** Comprehensive species profiles for all described Malagasy freshwater fishes, including habitat, distribution, morphometrics, trophic data, and conservation status. The `rfishbase` package provides the most practical programmatic access. Species pages like https://fishbase.se/summary/62937 (*Ptychochromis insolitus*) are useful for cross-validation. The platform should pull species-level metadata from FishBase during data ingestion.

### GBIF (Global Biodiversity Information Facility)

- **Main website:** https://www.gbif.org/
- **API base URL:** https://api.gbif.org/v1/
- **Technical documentation:** https://techdocs.gbif.org/en/openapi/
- **Key endpoints:**
  - Species match: `GET /v1/species/match?name=Ptychochromis+insolitus`
  - Species search: `GET /v1/species/search?q=Paretroplus`
  - Occurrence search: `GET /v1/occurrence/search?taxonKey=X&country=MG`
  - Occurrence download: `POST /v1/occurrence/download/request` (requires authentication)
- **Authentication:** None for read-only search; free account for downloads
- **Data format:** JSON; downloads in Darwin Core Archive or Simple CSV
- **Data standard:** Darwin Core (DwC)
- **R client:** `rgbif` — https://docs.ropensci.org/rgbif/
- **Python client:** `pygbif` — https://pygbif.readthedocs.io/
- **Annotation:** Contains georeferenced occurrence records for Madagascar freshwater fishes from museum collections and research expeditions. Country code `MG` filters to Madagascar. Essential for mapping species distributions, verifying locality records, and integrating occurrence data into the platform's GIS layer. The platform should export data in Darwin Core Archive format for interoperability.

### Eschmeyer's Catalog of Fishes

- **Main URL:** https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatmain.asp
- **Project page:** https://www.calacademy.org/scientists/projects/eschmeyers-catalog-of-fishes
- **Search guide:** https://www.calacademy.org/scientists/catalog-of-fishes-help
- **Species by family:** https://researcharchive.calacademy.org/research/ichthyology/catalog/SpeciesByFamily.asp
- **API:** None (web-based search interface only; HTML output)
- **Current editors:** Fricke, R., Eschmeyer, W. N. & R. van der Laan (eds.) 2026
- **Citation format:** Fricke, R., Eschmeyer, W. N. & R. van der Laan (eds.) 2026. Eschmeyer's Catalog of Fishes: Genera, Species, References. Electronic version accessed [date]. http://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatmain.asp
- **Annotation:** **THE authoritative reference for valid taxonomic names** for all described fish species. Coverage: 61,700+ species, 11,000+ genera, 34,000+ references, updated monthly. Essential for the platform's taxonomic backbone — verifying species names, checking synonymy, confirming type localities, and tracking new descriptions like *Malagodon honahona* and *Paretroplus risengi*. No API means manual verification or scraping would be needed for automated updates.

### WoRMS (World Register of Marine Species)

- **Main website:** https://www.marinespecies.org/
- **REST API documentation:** https://www.marinespecies.org/rest/
- **Key endpoints:**
  - `GET /AphiaRecordsByName/{ScientificName}` — Search by name
  - `GET /AphiaRecordByAphiaID/{AphiaID}` — Lookup by ID
  - `GET /AphiaRecordsByMatchNames` — Batch name matching
  - `GET /AphiaClassificationByAphiaID/{AphiaID}` — Full taxonomy
  - `GET /AphiaDistributionsByAphiaID/{AphiaID}` — Distributions
- **Authentication:** None required (open access)
- **Data format:** JSON or XML
- **R client:** `worrms` (rOpenSci) — https://docs.ropensci.org/worrms/
- **Annotation:** Primarily a **negative filter** for the platform. Cross-referencing against WoRMS identifies marine/brackish species that should be excluded from a freshwater-only platform, and flags euryhaline species (e.g., *Anguilla* spp., gobies, mullets) that enter freshwater seasonally. The `isMarine` and `isBrackish` flags in AphiaRecords are the key attributes.

### Species360 / ZIMS

- **Website:** https://species360.org/
- **ZIMS platform:** https://zims.species360.org/ (member login required)
- **Key modules:** ZIMS for Husbandry, ZIMS for Medical, ZIMS for Studbooks, ZIMS for Aquatics
- **Data holdings:** 22,000+ species; 10+ million animal records; 82+ million medical records from 1,300+ member institutions in 100+ countries
- **Access model:** **Membership-based only.** No public API. Tiered pricing based on institution size/location. EAZA membership requires Species360 participation.
- **Researcher access:** Species360 Insights program (subscription) and Conservation Science Alliance for collaborative research
- **Annotation:** **Critical for tracking ex-situ populations** of Malagasy freshwater fish globally. Leiss et al. (2022) used ZIMS as a primary data source. ZIMS tracks which institutions hold each species, individual counts, breeding success, and pedigree information. The platform should integrate ZIMS-derived data (likely manually exported or via institutional data sharing agreements) for its captive population dashboard.

### Zootierliste (ZTL)

- **Website:** https://www.zootierliste.de/
- **Maintained by:** Klaus and Martina Graf (private enthusiasts, community-contributed)
- **Coverage:** Vertebrate species in European zoos and aquaria (plus some Middle Eastern and North American institutions)
- **Access:** Free web interface; no API; no machine-readable export
- **Language:** Primarily German
- **Annotation:** Complementary to ZIMS for European captive population monitoring. **Captures holdings not in ZIMS** — Leiss et al. (2022) found ZTL listed 2 Malagasy species (*Pachypanchax varatraza*, *Paretroplus nourissati*) not recorded in ZIMS. Especially valuable for tracking smaller institutions and Citizen Conservation private breeders in Germany, Austria, and Czech Republic. The platform should cross-reference both ZIMS and ZTL for comprehensive captive population data.

---

## 3. Conservation frameworks and institutional resources

### IUCN SSC Freshwater Fish Specialist Group (FFSG)

- **Website:** https://freshwaterfish.org/
- **IUCN page:** https://www.iucn.org/our-union/commissions/species-survival-commission/ssc-specialist-groups
- **Co-Chairs:** Brian Zimmerman (Bristol Zoological Society) and Dr. Richard Sneider
- **Structure:** 17 regions, 160+ members; includes a dedicated Madagascar Regional Chair
- **Annotation:** The global authority on freshwater fish conservation science and policy. Supports the SHOAL 1,000 Fishes Blueprint, coordinates Red List assessments, and links in-situ and ex-situ experts. Key FFSG members (Stiassny, Sparks, Zimmerman, Fusari) are the primary scientific advisors whose work underpins the platform. The FFSG's six strategic goals (lead science, support in-situ, support ex-situ, science-policy, awareness, capacity) map directly to the platform's functional requirements.

### CPSG (Conservation Planning Specialist Group) and Ex-situ Conservation Assessment (ECA)

- **CPSG website:** https://www.cpsg.org/
- **ECA overview:** https://www.cpsg.org/our-work/what-we-do/ex-situ-conservation-assessment-0
- **ECA online course:** https://www.cpsg.org/our-work/capacity-building/courses/ex-situ-conservation-assessment
- **IUCN SSC Ex-situ Guidelines PDF:** https://www.cpsg.org/sites/default/files/2024-05/IUCN_SSC_ex_situ_guidelines_FINAL.pdf
- **ECA five-step process:** (1) Status assessment + threat analysis → (2) Identify ex-situ roles → (3) Define program characteristics → (4) Appraise feasibility/risks → (5) Informed decision on ex-situ activities
- **Annotation:** The ECA methodology will be the core decision framework used at the June 2026 ABQ BioPark workshop. The platform should support ECA data collection and decision-support workflows, including fields for each of the five decision steps. Since 2018, CPSG has trained 1,153 individuals from 92 countries in this methodology.

### One Plan Approach (OPA)

- **CPSG documentation:** https://www.cpsg.org/ (search "One Plan Approach")
- **Annotation:** The OPA develops management strategies for ALL populations of a species — wild and captive — as a single integrated plan. A 2020 IUCN World Conservation Congress resolution called on members to apply OPA. The platform embodies this approach by tracking both in-situ populations (field surveys, eDNA) and ex-situ populations (zoos, hobbyists) in a unified data model. Species360's ZIMS was recently integrated into the IUCN Red List to advance OPA.

### IUCN Resolution 112

- **Implementation lead:** CSS New Mexico (Center for Species Survival at ABQ BioPark / New Mexico BioPark Society)
- **Source:** https://iucn.org/our-union/commissions/species-survival-commission/partners-and-donors/centers-species-survival/css-united-states-new-mexico-biopark-society
- **Annotation:** Passed at the IUCN World Conservation Congress, Resolution 112 mandates that the global zoo and aquarium community play a significant role in halting freshwater fish extinction. CSS New Mexico is implementing it in partnership with SHOAL and FFSG by facilitating a global prioritization process for ex-situ populations. The June 2026 ABQ BioPark workshop is a direct implementation action. The platform should reference this resolution as policy authority for its institutional coordination features.

### EAZA Freshwater Teleost TAG

- **Formed:** 2019 (split from the former Fish and Aquatic Invertebrate TAG)
- **Chair:** Brian Zimmerman (Bristol Zoological Society)
- **Regional Collection Plan (RCP):** Published 2020
- **EEP programs:** Six EAZA Ex situ Programmes covering 7 families and 558 species (144 threatened, 5 Extinct in the Wild). Includes a dedicated **Bedotiidae (Malagasy rainbowfish) EEP**.
- **Source:** https://www.eaza.net/ (TAG documentation)
- **Annotation:** Coordinates European zoo populations of freshwater fish. The Bedotiidae EEP directly manages Malagasy rainbowfish breeding across European institutions. The platform should track EEP-managed species with their program coordinators and institutional recommendations.

### AZA Freshwater Fishes TAG

- **Parent organization:** Association of Zoos and Aquariums (AZA) — https://www.aza.org/
- **RCP:** AZA Freshwater Fish TAG Regional Collection Plan (1st edition, 2011), edited by Cynthia Lee
- **Programs:** Species Survival Plans (SSPs) for priority species; Breeding and Transfer Plans
- **Annotation:** AZA's North American counterpart to the EAZA TAG. Coordinates SSPs for threatened freshwater species in AZA-accredited facilities. The platform should track both EAZA and AZA program assignments for Malagasy species held in North American institutions.

### EDGE of Existence Programme

- **Website:** https://www.edgeofexistence.org/
- **Developer:** Zoological Society of London (ZSL), operational since 2007
- **Methodology:** EDGE = Evolutionarily Distinct × Globally Endangered. Formula: EDGE = ln(1+ED) + GE × ln(2). ED measured in millions of years of unique evolutionary history; GE derived from IUCN Red List extinction probability.
- **Coverage:** EDGE scores calculated for 70,000+ vertebrate species; 2024 EDGE Lists available for ray-finned fish
- **Annotation:** EDGE scores provide a complementary prioritization metric to IUCN Red List status alone. Species like *Malagodon madagascariensis* (deeply divergent Pantanodontidae lineage) likely score extremely high on evolutionary distinctiveness. The platform should display EDGE scores alongside Red List status for each species.

### IUCN Green Status of Species

- **Website:** https://www.iucnredlist.org/about/green-status-species
- **Methodology:** Version 2.0 published 2021. Assesses recovery across three dimensions: representation, viability, and functionality. Green Score (0–100%) calculated across spatial units.
- **Recovery categories:** Nine categories from "Fully Recovered" to "Extinct in the Wild"
- **Conservation impact metrics:** Conservation Legacy, Conservation Dependence, Conservation Gain, Recovery Potential
- **Key publication:** Akçakaya, H. R., et al. (2018). Quantifying species recovery and conservation success to develop an IUCN Green List of Species. *Conservation Biology*, 32(5), 1128–1138.
- **Annotation:** Complements the Red List by measuring species recovery and forecasting conservation impact. The platform could display Green Status assessments alongside Red List categories for assessed Malagasy species, providing a forward-looking recovery perspective rather than only threat status.

---

## 4. Conservation programs and organizations

### SHOAL Conservation

- **Website:** https://shoalconservation.org/
- **1,000 Fishes Blueprint:** https://shoalconservation.org/1000-fishes/
- **Blueprint PDF:** https://shoalconservation.org/wp-content/uploads/2024/06/SHOAL-1000-Fishes-Blueprint-compressed.pdf
- **FFSG partnership:** https://freshwaterfish.org/1000-fishes-blueprint/
- **Executive Director:** Mike Baltzer
- **Launched:** April 2024
- **Annotation:** SHOAL's 1,000 Fishes Blueprint aims to place at least 1,000 threatened freshwater fish on the path to recovery by 2035, selected from 2,300+ priority species. Madagascar is explicitly identified as an investment priority. The Blueprint provides the global strategic framework within which the platform's species prioritization operates. 74% of priority species are found across just 20 countries, making targeted collaboration highly efficient.

### CARES Preservation Program

- **Website:** https://caresforfish.org/
- **Priority List:** https://caresforfish.org/?page_id=40
- **Bedotiidae list:** https://caresforfish.org/?page_id=377
- **Cichlidae list:** https://caresforfish.org/?page_id=257
- **Founded:** 2004; Coordinator: Claudia Dickinson; Technical Editor: Dr. Paul V. Loiselle
- **Coverage:** ~600 species from 20 families, including ~24 Extinct-in-the-Wild. Major families: killifish, livebearers, cichlids (50% of species).
- **Annotation:** Engages hobbyist aquarists worldwide in conservation breeding. The CARES Beta Program Species List R4.1 (Bedotiidae and Cichlidae sheets as XLSX files) is a key data source the platform ingests. **Important caveat:** A 2019 study found significant disconnect between CARES classifications and IUCN assessments, so the platform must cross-reference both.

### Fish Net Madagascar

- **Website:** https://fishnetmadagascar.com/
- **Coordinator:** Charles Fusari (Director, Aquarium Tropical du Palais de la Porte Dorée, Paris; National Geographic Explorer)
- **Supported by:** Brian Zimmerman (Bristol Zoological Society)
- **Focal river:** Amboaboa River (northeastern Madagascar) — last known watershed for three CR species: *Ptychochromis insolitus*, *Paretroplus gymnopreopercularis*, and *Rheocles derhami*
- **Key activities:** Conservation breeding in ponds managed by APPA (Association des Producteurs Privés d'Alevins d'Andapa) since 2013; field expeditions; eDNA surveys; community-led conservation
- **Funders:** EUAC, American Cichlid Association, Toronto Zoo, ZSL, Denver Zoo
- **Annotation:** The on-the-ground operational program that generates the field data the platform must ingest. Fish Net Madagascar's rediscovery of *P. insolitus* in 2013 (once "the rarest fish in the world") and establishment of insurance populations at Toronto Zoo, Cologne Zoo, and ZSL is the signature conservation success story the platform documents.

### Madagascar Fauna and Flora Group (MFG)

- **Website:** https://madagascarfaunaflora.org/
- **Founded:** 1988 by WCS and CBSG/CPSG; 30 member institutions
- **Headquarters:** Toamasina, Madagascar (international HQ at Saint Louis Zoo, USA)
- **Focus sites:** Parc Ivoloina (282-hectare conservation center) and Betampona Natural Reserve
- **Annotation:** International consortium of zoos, aquariums, botanical gardens, and universities coordinating conservation in eastern Madagascar. Supports the ex-situ breeding network described in Leiss et al. (2022). The platform should list MFG as a key institutional partner and data contributor.

### Citizen Conservation (CC)

- **Website:** https://citizen-conservation.org/
- **Based in:** Berlin, Germany (Citizen Conservation Foundation gGmbH)
- **Wild at Home platform:** Wildlife management database for coordinated breeding by private keepers; developed with German Federal Ministry funding; currently in beta.
- **Madagascar fish species in CC program:** *Ptychochromis insolitus*, *Ptychochromis loisellei*, *Bedotia madagascariensis*
- **Key staff:** Björn Encke, Tina Nagorzanski
- **Annotation:** Bridges professional zoos and private breeders for coordinated ex-situ conservation. The Wild at Home platform is a parallel system whose data the platform should integrate. CC's coordination of private breeders in Germany, Austria, and Czech Republic extends the ex-situ safety net beyond institutional collections.

### Durrell Wildlife Conservation Trust

- **Website:** https://www.durrell.org/
- **Madagascar work since:** 1986; ~30 staff (mostly Malagasy)
- **Freshwater focus:** Nosivolo River (greatest concentration of freshwater fish species in Madagascar, with 19 endemic species including 4 found nowhere else). Recognized as a Ramsar Site through Durrell's work.
- **Conservation Academy:** 6,000+ students trained since 1980
- **Annotation:** Leads on habitat-level freshwater conservation in Madagascar. The Nosivolo River work demonstrates the in-situ complement to ex-situ breeding — the platform should connect species records to habitat conservation status at sites like Nosivolo.

### Bristol Zoological Society (BZS)

- **Website:** https://www.bristolzoo.org.uk/
- **Key person:** Brian Zimmerman — Director of Conservation and Science; Co-Chair IUCN SSC FFSG; Chair EAZA Freshwater Teleost TAG; creator of ZSL's Fish Net Programme
- **Programs:** European breeding programme for Corfu toothcarp (*Valencia letourneuxi*); white-clawed crayfish; Malagasy freshwater fish via EAZA EEPs
- **Annotation:** Zimmerman's dual role as FFSG Co-Chair and EAZA TAG Chair makes BZS a central node in global freshwater fish conservation governance. The platform's institutional network should treat BZS as a primary coordination partner.

### Cologne Zoo (Kölner Zoo) — Aquarium Department

- **Key person:** Prof. Dr. Thomas Ziegler — Curator, Aquarium/Terrarium; Adjunct Professor, University of Cologne
- **Species bred:** *Pachypanchax sakaramyi* (EN), *Bedotia madagascariensis* (EN), *Rheocles vatosoa* (EN), *Ptychochromis insolitus* (CR), *P. loisellei* (EN), *Ptychochromis oligacanthus*, plus several *Bedotia* and *Pachypanchax* species
- **Annotation:** Cologne Zoo holds the most diverse institutional collection of Malagasy freshwater fish in Germany. Ziegler's lab performed DNA barcoding of all captive stocks for identity confirmation — essential for potential repatriation. The platform's husbandry protocols and breeding data fields should reflect Ziegler et al. (2020) protocols.

### ABQ BioPark / New Mexico BioPark Society / CSS New Mexico

- **Center for Species Survival (CSS) New Mexico:** Established 2018 with the New Mexico BioPark Society to support the IUCN SSC
- **Conservation Director:** Tim Lyons (FFSG Steering Committee member for reintroduction and ex-situ conservation)
- **IUCN source:** https://iucn.org/our-union/commissions/species-survival-commission/partners-and-donors/centers-species-survival/css-united-states-new-mexico-biopark-society
- **Annotation:** Leading the implementation of IUCN Resolution 112 and hosting the June 2026 Global Freshwater Fish Ex-Situ Conservation Assessment Workshop. Tim Lyons has authored/reviewed Red List assessments for ~10% of freshwater fish species globally. The platform should position CSS New Mexico as a primary institutional partner for the global prioritization process.

### American Museum of Natural History (AMNH) — Department of Ichthyology

- **Website:** https://www.amnh.org/research/vertebrate-zoology/ichthyology
- **Collection:** ~3.2 million specimens, 200,000 lots, 48,000 skeletons, 24,000 tissue samples, 625+ primary types
- **Key researchers:**
  - **Dr. Melanie L. J. Stiassny** — Axelrod Research Curator and Curator-in-Charge. Pioneered Madagascar freshwater fish conservation science.
  - **Dr. John S. Sparks** — Curator-in-Charge. Systematics, evolution, and biogeography of freshwater and marine fishes. Described multiple Malagasy cichlid species.
- **Annotation:** AMNH provides the taxonomic and systematic research backbone for Malagasy ichthyology. The museum's specimen collection and Sparks/Stiassny's ongoing revisions are the source of truth for species validity, type specimens, and phylogenetic relationships used throughout the platform.

---

## 5. Key data sources for the platform

### CARES Beta Program Species List R4.1

- **Source:** Internal XLSX files (Bedotiidae and Cichlidae sheets)
- **Public list:** https://caresforfish.org/?page_id=40
- **Annotation:** The R4.1 beta list provides the most current hobbyist-tracked species inventory for Madagascar's Bedotiidae (rainbowfishes) and Cichlidae (cichlids). The platform ingests these sheets as a data layer complementing ZIMS/ZTL institutional data. Note that public CARES lists may lag behind the beta version.

### Leiss et al. (2022) supplementary data

- **Article:** https://doi.org/10.1002/zoo.21661
- **Key tables (within article):**
  - **Table 1:** All 173 fish species from Malagasy freshwater habitats, sorted by family, with IUCN status and ZIMS records
  - **Table 6:** 31 threatened endemic species NOT held in captivity
  - Figures showing institutional holdings by family in North American (659 individuals) and European (3,602 individuals) zoos
- **Data availability:** "Available from the corresponding author upon reasonable request" (Thomas Ziegler: ziegler@koelnerzoo.de)
- **License:** CC BY-NC-ND 4.0
- **Annotation:** The primary baseline dataset for the platform. Tables 1 and 6 define the complete species inventory and conservation gap analysis. The platform's initial data seeding should draw directly from these tables.

### IUCN Red List spatial data for Madagascar freshwater fish

- **Spatial data downloads:** https://www.iucnredlist.org/resources/spatial-data-download (requires login)
- **Formats:** Esri shapefiles (polygons), CSV point tables, Freshwater HydroBASIN tables
- **Regional assessment:** Máiz-Tomé et al. (2018) — https://portals.iucn.org/library/sites/library/files/documents/RL-2018-001.pdf
- **Annotation:** Species range polygons and HydroBASIN occurrence tables enable the platform's GIS layer. HydroBASINS tables map species to pre-defined catchment units, directly supporting watershed-level conservation planning aligned with Wilmé et al.'s (2006) biogeographic framework.

### Protected Planet / WDPA

- **Main portal:** https://www.protectedplanet.net/en
- **Madagascar page:** https://www.protectedplanet.net/country/MDG
- **API v4 documentation:** https://api.protectedplanet.net/documentation
- **API key request:** https://api.protectedplanet.net/request
- **Python package:** `pywdpa` — https://pypi.org/project/pywdpa/ (ISO3 code: `MDG`)
- **Data format:** Shapefiles, GeoPackage
- **Note:** API v3 deprecated; **to be removed May 1, 2026** — platform must use v4
- **Citation:** UNEP-WCMC and IUCN (2026). Protected Planet: The World Database on Protected Areas (WDPA). Cambridge, UK. www.protectedplanet.net
- **Annotation:** Essential for spatial overlap analysis between species distributions and protected areas. The Django backend should use the WDPA API for automated ingestion of PA boundaries, then calculate overlap with species ranges for gap analysis dashboards.

### Key Biodiversity Areas (KBA) data

- **World Database of KBAs:** Managed by BirdLife International on behalf of the KBA Partnership; updated biannually
- **Access via IBAT:** https://www.ibat-alliance.org/datasets/world-database-of-key-biodiversity-areas
- **Madagascar protected areas portal:** https://protectedareas.mg/ (interactive web-GIS with Creative Commons license)
- **ArcGIS Hub (SAPM):** https://hub.arcgis.com/datasets/4218737646234c7cab1c7a20e2c2489d (Madagascar Protected Area System shapefiles)
- **Annotation:** Freshwater KBAs identify critical aquatic habitats beyond formal protected areas. The platform's map layer should overlay KBA boundaries alongside WDPA protected areas for comprehensive spatial conservation analysis.

---

## 6. Workshop and meeting references

### Global Freshwater Fish Ex-Situ Conservation Assessment Workshop

- **Organizer:** CSS New Mexico (ABQ BioPark), in partnership with CPSG, SHOAL, and IUCN FFSG
- **Date:** June 1–5, 2026
- **Location:** ABQ BioPark, Albuquerque, New Mexico, USA
- **Methodology:** CPSG Ex-situ Conservation Assessment (ECA) — multi-species format
- **Key personnel:** Tim Lyons (Conservation Director, CSS NM); CPSG facilitators
- **Context:** Implements IUCN Resolution 112; follows the 2025 *Nature* publication of the first global freshwater fauna Red List assessment
- **Source:** https://iucn.org/our-union/commissions/species-survival-commission/partners-and-donors/centers-species-survival/css-united-states-new-mexico-biopark-society
- **Annotation:** This workshop will produce the definitive global prioritization for ex-situ freshwater fish programs. The platform should be prepared to ingest workshop outputs (species priority rankings, ECA decisions, institutional assignments) and ideally serve as a data resource during the workshop itself.

### CPSG ECA methodology documentation

- **Overview:** https://www.cpsg.org/our-work/what-we-do/ex-situ-conservation-assessment-0
- **Self-paced course:** https://www.cpsg.org/our-work/capacity-building/courses/ex-situ-conservation-assessment
- **IUCN SSC Guidelines PDF:** https://www.cpsg.org/sites/default/files/2024-05/IUCN_SSC_ex_situ_guidelines_FINAL.pdf
- **Annotation:** The authoritative decision framework the platform must support. The five-step ECA process should map to platform data fields: status assessment, potential ex-situ roles, program dimensions, feasibility appraisal, and final recommendation.

### Malagasy Freshwater Fishes Conservation Group meeting (January 2026)

- **Citation:** Malagasy Freshwater Fishes Conservation Group. (2026, January). *Meeting proceedings* [Internal document, PDF].
- **Access:** Internal to project team
- **Annotation:** Internal planning meeting whose outcomes inform the platform's priorities and institutional partnerships. Should be cited in platform documentation but is not publicly available.

---

## 7. Population genetics and breeding management tools

### PMx Software

- **Website:** https://scti.tools/pmx/
- **Current version:** PMx v1.8.1.20250501
- **Manual:** https://scti.tools/manuals/PMxManual.pdf
- **Developer:** Species Conservation Toolkit Initiative (SCTI); originally by Jonathan Ballou (Smithsonian), Robert Lacy (Chicago Zoological Society), and JP Pollak (Cornell)
- **License:** Creative Commons Attribution-NoDerivatives International
- **Key publication:** Lacy, R. C., Ballou, J. D., & Pollak, J. P. (2012). PMx: Software package for demographic and genetic analysis and management of pedigreed populations. *Methods in Ecology and Evolution*, 3, 433–437. https://doi.org/10.1111/j.2041-210X.2011.00148.x
- **Current citation:** Ballou, J. D., Lacy, R. C., Pollak, J. P., Callicrate, T., & Ivy, J. (2025). PMx: Software for demographic and genetic analysis and management of pedigreed populations (Version 1.8.1.20250501). Chicago Zoological Society. http://www.scti.tools
- **Capabilities:** Pedigree analysis (inbreeding coefficients, mean kinship, founder representation), demographic modeling, breeding pair recommendations. Integrates with ZIMS/SPARKS studbook data.
- **Annotation:** The standard tool for managing ex-situ breeding programs. The platform should support import/export of PMx-compatible data formats for species like *Ptychochromis insolitus* where studbook management is critical. PMxLite offers a simplified interface for casual users.

### eDNA survey methodology references

**Oliveira Carvalho, C., et al. (2024).** [Full citation above in Section 1]. Used MiFish, Tele02, and Riaz primers in Amboaboa River. https://doi.org/10.1038/s41598-024-71398-z
- **Annotation:** The primary Madagascar-specific eDNA methodology reference. Demonstrated that eDNA detected only a subset of species found by traditional methods, highlighting the need for combined approaches and better reference databases.

**Vences, M., et al. (2022).** [Full citation above in Section 1]. Curated reference database for eDNA interpretation. https://doi.org/10.1371/journal.pone.0271400
- **Annotation:** The molecular reference library required for species-level eDNA identification in Madagascar. Without this database, eDNA surveys cannot resolve detections to species for many endemic taxa.

**Miya, M., et al. (2020).** MiFish metabarcoding: A high-throughput approach for simultaneous detection of multiple fish species from environmental DNA and other samples. *Fisheries Science*. https://link.springer.com/article/10.1007/s12562-020-01461-x
- **Annotation:** Established MiFish 12S rRNA primers as the standard universal marker for eDNA fish surveys. The platform should track which primers were used in each survey for comparability.

**Cilleros, K., et al. (2019).** Optimizing environmental DNA sampling effort for fish inventories in tropical streams and rivers. *Scientific Reports*, 9, 3085. https://doi.org/10.1038/s41598-019-39399-5
- **Annotation:** Tested in French Guiana tropical streams; found 34 liters of water detected >64% of expected fauna. Provides protocol optimization guidance applicable to Malagasy rivers.

### Cryopreservation protocols

**Kopeika, E., Kopeika, J., & Zhang, T. (2007).** Cryopreservation of fish sperm. In J. G. Day & G. N. Stacey (Eds.), *Cryopreservation and freeze-drying protocols*. Methods in Molecular Biology, vol. 368. Humana Press. https://link.springer.com/protocol/10.1007/978-1-59745-362-2_14
- **Annotation:** Detailed protocol for freshwater fish sperm cryopreservation. Critical for genetic banking of species like *P. insolitus* where living populations are extremely small.

**Torres, L., et al. (2017).** Cryopreservation in fish: Current status and pathways to quality assurance and quality control in repository development. *Reproduction, Fertility and Development*, 29(12). https://pmc.ncbi.nlm.nih.gov/articles/PMC5600707/
- **Annotation:** Covers the full four-stage pipeline: fish conditioning, sample collection, freezing/storage, and egg collection/use. The platform could track cryopreserved material metadata.

**Cabrita, E., et al. (2010).** Cryopreservation of fish sperm: Applications and perspectives. *Journal of Applied Ichthyology*, 26, 623–635. https://doi.org/10.1111/j.1439-0426.2010.01556.x
- **Annotation:** Reviews applications for conservation, aquaculture, and genetic banking. Relevant for planning cryopreservation capacity for Malagasy species.

---

## 8. Technical documentation for platform development

### Django

- **Documentation:** https://docs.djangoproject.com/en/6.0/
- **Current stable:** Django 6.0.4 (released April 7, 2026); Django 6.0 released December 3, 2025
- **LTS version:** Django 5.2.13 (LTS; security support through ~April 2028)
- **Download:** https://www.djangoproject.com/download/
- **License:** BSD License
- **Python support:** Django 6.0 supports Python 3.12–3.14
- **Annotation:** Core backend framework for the platform. Django's ORM models complex biodiversity data relationships (species ↔ specimens ↔ locations ↔ assessments ↔ institutions). Django 5.2 LTS recommended for production stability; Django 6.0 adds Background Tasks useful for API data ingestion from IUCN/GBIF.

### Next.js

- **Documentation:** https://nextjs.org/docs
- **Current stable:** Next.js 16.2.3 (released April 8, 2026)
- **Blog:** https://nextjs.org/blog
- **GitHub:** https://github.com/vercel/next.js/releases
- **License:** MIT License
- **Key v16 features:** Turbopack as default bundler, Cache Components with PPR, DevTools MCP
- **Annotation:** Frontend framework for the platform. Server-side rendering enables SEO-friendly species pages; static generation serves reference data; the App Router supports complex interactive dashboards with species maps, breeding recommendations, and institutional coordination views.

### Django REST Framework (DRF)

- **Documentation:** https://www.django-rest-framework.org/
- **API Guide:** https://www.django-rest-framework.org/api-guide/
- **Current version:** DRF 3.17.1 (released March 24, 2026)
- **GitHub:** https://github.com/encode/django-rest-framework
- **License:** BSD License
- **Annotation:** Provides the REST API layer between Django backend and Next.js frontend. DRF serializers handle species records, spatial data, and assessment results. Its authentication system supports multi-institution access, and the browsable API aids development and GBIF/IUCN integration testing.

### Apache 2.0 License

- **Full text:** https://www.apache.org/licenses/LICENSE-2.0
- **SPDX identifier:** Apache-2.0
- **Annotation:** Permissive open-source license allowing commercial use, modification, and distribution. Requires copyright/license preservation and provides an express patent grant. Permits broad reuse by conservation organizations, zoos, and research institutions while protecting contributors. Compatible with BSD (Django/DRF) and MIT (Next.js) licenses in the stack.

### Darwin Core Standard

- **Specification:** https://dwc.tdwg.org/
- **Quick reference guide (all terms):** https://dwc.tdwg.org/terms/
- **TDWG standard page:** https://www.tdwg.org/standards/dwc/
- **GitHub repository:** https://github.com/tdwg/dwc
- **Key publication:** Wieczorek, J., et al. (2012). Darwin Core: An evolving community-developed biodiversity data standard. *PLoS ONE*, 7(1), e29715. https://doi.org/10.1371/journal.pone.0029715
- **Key term classes:** Occurrence, Event, Location, Taxon, Identification, MeasurementOrFact, ResourceRelationship
- **Annotation:** **The critical data interoperability standard.** Django data models should map to Darwin Core terms (`occurrenceID`, `scientificName`, `decimalLatitude`, `decimalLongitude`, `basisOfRecord`, `establishmentMeans`) for seamless data exchange with GBIF, IUCN, and partner institutions. DRF serializers should support Darwin Core Archive export format.

### TDWG (Biodiversity Information Standards) — additional standards

- **Standards overview:** https://www.tdwg.org/standards/
- **FAIRsharing collection:** https://fairsharing.org/collection/TDWGBiodiversity
- **Key standards beyond Darwin Core:**
  - **ABCD** (Access to Biological Collection Data): https://www.tdwg.org/standards/abcd/ — comprehensive XML schema for specimen data; GitHub: https://github.com/tdwg/abcd
  - **TCS** (Taxonomic Concept Schema) — for exchanging taxonomic name and concept information; relevant for managing the complex synonymy of Malagasy fishes
  - **Audiovisual Core** — media metadata schema for species photographs
  - **Latimer Core** — collection-level descriptions
- **Annotation:** Darwin Core is the primary standard for the platform. TCS may be relevant for managing taxonomic revisions (e.g., *Pantanodon* → *Malagodon*) and multiple synonym chains. ABCD compatibility should be considered if European collection networks (BioCASe) need to interoperate with the platform.

---

## Quick-reference table: Database APIs at a glance

| Database | Base URL | API available | Authentication | Primary data format |
|---|---|---|---|---|
| IUCN Red List | api.iucnredlist.org | Yes (v4 REST) | Free token (signup) | JSON |
| FishBase | fishbase.ropensci.org | S3 API | None | Parquet |
| GBIF | api.gbif.org/v1 | Yes (REST) | None (search); account (downloads) | JSON / DwC Archive |
| Eschmeyer's CoF | researcharchive.calacademy.org | No (web only) | None | HTML |
| WoRMS | marinespecies.org/rest | Yes (REST) | None | JSON / XML |
| Species360/ZIMS | zims.species360.org | No public API | Membership required | Member-only |
| Zootierliste | zootierliste.de | No | None | HTML |
| Protected Planet | api.protectedplanet.net | Yes (v4 REST) | Free token | Shapefiles / GeoPackage |
| GBIF occurrence | api.gbif.org/v1/occurrence | Yes (REST) | Account for bulk downloads | JSON / CSV |

---

## Version and maintenance notes

This reference library reflects the state of all citations, URLs, API versions, and software releases as of **April 2026**. Key items requiring periodic updates include IUCN Red List assessments (reassessment cycles vary), GBIF occurrence data (continuously updated), WDPA boundaries (monthly updates), software versions (Django, Next.js, DRF), and the CARES Priority List (rolling updates). The IUCN Red List API v3 was sunset in March 2025 — all platform integrations must use v4. The Protected Planet API v3 is scheduled for removal on May 1, 2026 — migration to v4 is urgent. New species descriptions from 2024–2025 (*Malagodon honahona*, *Paretroplus risengi*, undescribed Makira species) should be tracked for formal publication and addition to the platform's taxonomic backbone.