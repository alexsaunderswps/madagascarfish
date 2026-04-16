# Data Preparation Guide — Seed CSVs

This document provides column-by-column guidance for the two seed data CSVs required before the MVP frontend can be demonstrated. Both CSVs are loaded by management commands during Gate 06.

**Execution order:** `load_reference_layers` (shapefiles) -> `seed_species` (species CSV) -> `seed_localities` (localities CSV) -> `generate_map_layers`

---

## 1. Species Seed CSV

**File:** `data/seed/madagascar_freshwater_fish_seed.csv`
**Loaded by:** `python manage.py seed_species --csv data/seed/madagascar_freshwater_fish_seed.csv`
**Idempotent key:** `scientific_name` (updates existing records on re-run)

### Column Reference

| # | Column | Required | Type | Allowed Values | Notes |
|---|--------|----------|------|----------------|-------|
| 1 | `scientific_name` | Yes | string | — | Unique identifier. For undescribed taxa use the conventional format: `Genus sp. 'epithet'` (e.g., `Bedotia sp. 'manombo'`) |
| 2 | `authority` | No | string | — | Taxonomic authority (e.g., `Holly, 1928`). Leave blank for undescribed taxa. |
| 3 | `year_described` | No | integer | — | Year of formal description. Leave blank for undescribed taxa. |
| 4 | `family` | Yes | string | — | Family name (e.g., `Bedotiidae`, `Cichlidae`, `Aplocheilidae`) |
| 5 | `genus` | Yes | string | — | Genus name |
| 6 | `endemic_status` | Yes | enum | `endemic`, `native`, `introduced` | Most Malagasy species are `endemic`. Use `native` for diadromous/widespread species, `introduced` for invasives. |
| 7 | `iucn_status` | No | enum | `EX`, `EW`, `CR`, `EN`, `VU`, `NT`, `LC`, `DD`, `NE` | IUCN Red List category. Leave blank if not assessed (treated as `NE`). |
| 8 | `iucn_taxon_id` | No | integer | — | IUCN Red List taxon ID. Enables automated IUCN sync. Find at: https://www.iucnredlist.org (search species, ID is in the URL). |
| 9 | `population_trend` | No | enum | `increasing`, `stable`, `decreasing`, `unknown` | IUCN population trend. Leave blank if unknown. |
| 10 | `cares_status` | No | enum | `CCR`, `CEN`, `CVU`, `CLC` | CARES 2.0 conservation priority. Leave blank if not CARES-listed. |
| 11 | `taxonomic_status` | Yes | enum | `described`, `undescribed_morphospecies`, `species_complex`, `uncertain` | Default: `described`. Use `undescribed_morphospecies` for recognized but formally undescribed taxa. |
| 12 | `provisional_name` | No | string | — | Informal epithet for undescribed taxa (e.g., `'manombo'`, `'nosivola'`). Leave blank for described species. |
| 13 | `shoal_priority` | No | boolean | `true`, `false` | Whether this species appears on the SHOAL 1,000 Fishes Blueprint. Default: `false`. |
| 14 | `fishbase_id` | No | integer | — | FishBase species ID. Find at: https://www.fishbase.se |
| 15 | `distribution_narrative` | No | string | — | Free text description of geographic range. |
| 16 | `habitat_type` | No | string | — | Habitat description (e.g., `streams`, `rivers and lakes`, `cave systems`). |
| 17 | `max_length_cm` | No | decimal | — | Maximum total length in centimeters. |
| 18 | `in_captivity` | No | enum | `Y`, `N` | Whether the species is known to be held in captivity. Imported as `BooleanField` on Species model. Useful for public display before ExSituPopulation records exist. Default: `false`. |
| 19 | `captive_institutions` | No | string | — | Comma-separated institution names holding this species. Informational only — not imported to database. |
| 20 | `notes` | No | string | — | Provenance notes for data curator. Not imported to database. |

### Example Rows

```csv
scientific_name,authority,year_described,family,genus,endemic_status,iucn_status,iucn_taxon_id,population_trend,cares_status,taxonomic_status,provisional_name,shoal_priority,fishbase_id,distribution_narrative,habitat_type,max_length_cm,in_captivity,captive_institutions,notes
Pachypanchax sakaramyi,"Holly, 1928",1928,Aplocheilidae,Pachypanchax,endemic,EN,166478,decreasing,CEN,described,,false,10914,Northern Madagascar; Sakaramy River drainage,streams,8.5,Y,"Cologne Zoo, London Zoo",ZIMS records confirm holdings
Bedotia sp. 'manombo',,,Bedotiidae,Bedotia,endemic,,,,,undescribed_morphospecies,'manombo',false,,Manombo Special Reserve area,streams,,Y,"Private breeders (CARES)",CARES 2026 R4.1 priority
Oreochromis niloticus,"(Linnaeus, 1758)",1758,Cichlidae,Oreochromis,introduced,LC,166775,stable,,described,,false,2,Introduced throughout Madagascar,rivers and lakes,60.0,N,,Major invasive threat to endemic fauna
```

### Guidance for Undescribed Taxa

Including undescribed morphospecies is valuable if:
- The taxon is recognized by specialists (published in literature or known from collections)
- It has conservation significance (threatened habitat, CARES-listed, captive populations exist)
- It has locality data you can provide

If an undescribed taxon has no locality data and no captive populations, it adds limited value to the MVP demonstration.

---

## 2. Species Localities Seed CSV

**File:** `data/localities/madagascar_freshwater_fish_localities.csv`
**Loaded by:** `python manage.py seed_localities --csv data/localities/madagascar_freshwater_fish_localities.csv`
**Idempotent key:** `(scientific_name, latitude+longitude, locality_type)` — safe to re-run
**Prerequisite:** Species must be loaded first (`seed_species`). Reference layers should be loaded first (`load_reference_layers`) for drainage basin FK assignment.

### Column Reference

| # | Column | Required | Type | Default | Allowed Values | Notes |
|---|--------|----------|------|---------|----------------|-------|
| 1 | `scientific_name` | Yes | string | — | — | Must match a `Species.scientific_name` exactly. Rows with no match are skipped with a warning. |
| 2 | `latitude` | Yes | decimal | — | -26.0 to -11.5 | Decimal degrees, WGS84. Negative = south. |
| 3 | `longitude` | Yes | decimal | — | 43.0 to 51.0 | Decimal degrees, WGS84. Positive = east. |
| 4 | `locality_name` | Yes | string | — | — | Human-readable place name (e.g., "Sakaramy River near Joffreville", "Lac Alaotra"). |
| 5 | `locality_type` | Yes | enum | — | `type_locality`, `collection_record`, `literature_record`, `observation` | See guidance below. |
| 6 | `presence_status` | No | enum | `present` | `present`, `historically_present_extirpated`, `presence_unknown`, `reintroduced` | Default `present` if omitted. |
| 7 | `water_body` | No | string | *(blank)* | — | Name of the river, lake, or stream. |
| 8 | `water_body_type` | No | enum | *(blank)* | `river`, `lake`, `stream`, `cave_system`, `wetland`, `estuary` | |
| 9 | `coordinate_precision` | No | enum | `exact` | `exact`, `approximate`, `locality_centroid`, `water_body_centroid` | See guidance below. |
| 10 | `year_collected` | No | integer | *(null)* | — | Year of collection, observation, or publication. |
| 11 | `collector` | No | string | *(blank)* | — | Person, team, or expedition name. |
| 12 | `source_citation` | Yes | string | — | — | Publication, database, or survey reference. |
| 13 | `is_sensitive` | No | boolean | `false` | `true`, `false` | See guidance below. |
| 14 | `notes` | No | string | *(blank)* | — | Free text. |

### Auto-Computed Fields (NOT in CSV)

These are set automatically by the management command or model `save()` — do not include them in the CSV:

| Field | How It's Set |
|-------|-------------|
| `drainage_basin` | Spatial query: `Watershed.objects.filter(geometry__contains=point)`. Assigned to the smallest matching watershed by area. Null if no watershed contains the point. |
| `drainage_basin_name` | Denormalized from `drainage_basin.name` on save. |
| `location_key` | Computed as `"{lng:.5f},{lat:.5f}"` for uniqueness constraint. |
| `location_generalized` | For `is_sensitive=true` records: coordinates rounded to 0.1 degree. Public API serves these instead of exact coordinates. |

### Example Rows

```csv
scientific_name,latitude,longitude,locality_name,locality_type,presence_status,water_body,water_body_type,coordinate_precision,year_collected,collector,source_citation,is_sensitive,notes
Pachypanchax sakaramyi,-12.5200,49.1800,Sakaramy River near Joffreville,type_locality,present,Sakaramy River,stream,exact,1928,Holly,Holly 1928,false,Original type locality description
Pachypanchax sakaramyi,-12.5350,49.1650,Sakaramy tributary upstream of village,collection_record,present,Sakaramy River,stream,approximate,2019,Sparks & Stiassny,Sparks & Stiassny 2019,false,Recent survey confirmation
Bedotia sp. 'manombo',-23.0800,47.7200,Manombo Special Reserve stream,observation,present,,stream,exact,2022,Durrell team,Durrell field survey 2022,true,Exact location sensitive — CR species with very restricted range
Ptychochromis insolitus,-14.5200,49.7000,Nosivolo River at Marolambo,type_locality,historically_present_extirpated,Nosivolo River,river,exact,1926,Pellegrin,Pellegrin 1926,false,Not observed since original collection; extirpated from type locality
Oreochromis niloticus,-18.9200,47.5200,Lac Alaotra,observation,present,Lac Alaotra,lake,locality_centroid,,,"GBIF occurrence records, multiple observers",false,Invasive; coordinates placed at lake centroid
```

### Guidance: `locality_type`

| Value | Use When |
|-------|----------|
| `type_locality` | The location where the species was originally described. Each described species should have exactly one. |
| `collection_record` | A museum voucher specimen or verified collection with coordinates. Highest confidence. |
| `literature_record` | Coordinates derived from a publication but without a specific voucher. Common for older literature. |
| `observation` | Field sighting, eDNA detection, or unvouchered record. Includes recent surveys. |

### Guidance: `coordinate_precision`

This field is critical for data quality assessment on the map.

| Value | Use When | Typical Source |
|-------|----------|----------------|
| `exact` | GPS coordinates from the collector or precise georeferencing | Field surveys, GPS-tagged collections |
| `approximate` | Coordinates estimated from a described locality but not GPS-verified | Literature with descriptive localities ("near village X") |
| `locality_centroid` | Point placed at the center of a named locality (town, reserve) | Records with only a locality name, no coordinates |
| `water_body_centroid` | Point placed at the center of a named water body | Records that say "Lac Alaotra" with no further detail |

**Rule of thumb:** If you're placing a point on a map based on a place name rather than recorded coordinates, use `approximate`, `locality_centroid`, or `water_body_centroid` as appropriate. The map displays all precision levels but the field helps users assess what they're looking at.

### Guidance: `is_sensitive`

Set `is_sensitive = true` when:
- The species is CR or EN **and** has a very restricted range (single river, single cave)
- Exact coordinates could enable poaching, collection pressure, or habitat disturbance
- The coordinates are precise enough to locate the actual site

When `is_sensitive = true`, the public API serves coordinates rounded to 0.1 degree (~11km). Tier 3+ users see exact coordinates via Django Admin.

**When in doubt, leave as `false`.** Most historical collection records and type localities are already published in literature and are not sensitive. Sensitivity is primarily for recently discovered, range-restricted populations.

### Guidance: `source_citation`

Be specific enough that a reviewer can trace the record back. Examples:
- `Holly 1928` — original species description
- `Sparks & Stiassny 2003, Syst. Biodiv. 1:313-344` — published revision
- `GBIF.org (accessed 2026-04-15), occurrence ID 12345` — GBIF record
- `Durrell field survey 2022, unpublished` — field data
- `FishBase, accessed 2026-04-15` — online database

---

## 3. Reference Layer Data (Shapefiles)

These are not CSVs — they are shapefiles downloaded from external sources and loaded by management command.

### HydroBASINS Watersheds

**File:** `data/reference/hydrobasins_madagascar_lev06.shp`
**Source:** https://www.hydrosheds.org/products/hydrobasins (Africa, Level 06)
**Preparation:** Download the Africa level 6 dataset, filter/clip to Madagascar bounding box (lat -26.0 to -11.5, lng 43.0 to 51.0). Export as shapefile.
**Expected records:** ~60–100 watershed polygons
**Loaded by:** `python manage.py load_reference_layers --watersheds data/reference/hydrobasins_madagascar_lev06.shp`

### WDPA Protected Areas

**File:** `data/reference/wdpa_madagascar.shp`
**Source:** https://www.protectedplanet.net/en/thematic-areas/wdpa (monthly download)
**Preparation:** Download the current WDPA dataset, filter to `ISO3 = 'MDG'`. Export as shapefile.
**Expected records:** ~120–160 protected area polygons
**Loaded by:** `python manage.py load_reference_layers --protected-areas data/reference/wdpa_madagascar.shp`

---

## 4. Validation Checklist

Before running the seed commands, verify:

### Species CSV
- [ ] All `scientific_name` values are unique
- [ ] All `family` and `genus` values are non-empty
- [ ] `endemic_status` values are one of: `endemic`, `native`, `introduced`
- [ ] `taxonomic_status` values are one of: `described`, `undescribed_morphospecies`, `species_complex`, `uncertain`
- [ ] Undescribed taxa have `authority` and `year_described` blank
- [ ] Undescribed taxa have `provisional_name` set
- [ ] `iucn_status` values (when present) are valid IUCN codes
- [ ] `iucn_taxon_id` values (when present) are valid integers from iucnredlist.org

### Localities CSV
- [ ] All `scientific_name` values match a row in the species CSV
- [ ] All coordinates are within Madagascar extent (lat -26.0 to -11.5, lng 43.0 to 51.0)
- [ ] Each described species has at most one `type_locality` record
- [ ] `locality_type` values are one of the four allowed enums
- [ ] `coordinate_precision` reflects how the coordinates were obtained (not always `exact`)
- [ ] `source_citation` is non-empty for every row
- [ ] `is_sensitive` is only set for genuinely sensitive records (CR/EN, restricted range, precise coords)
- [ ] No duplicate rows (same species + same coordinates + same locality_type)

### Reference Layers
- [ ] Shapefiles have valid `.shp`, `.shx`, `.dbf`, `.prj` files
- [ ] HydroBASINS features have `HYBAS_ID` and `PFAF_ID` attributes
- [ ] WDPA features have `WDPAID`, `NAME`, `DESIG_ENG`, `IUCN_CAT` attributes
- [ ] Both datasets are in WGS84 (EPSG:4326)

---

## 5. Timeline

Per the conservation map integration spec, the localities CSV is on the critical path for the ECA Workshop demo (June 1–5, 2026). Target completion: **May 25, 2026** (one week buffer).

A "thin seed" fallback (type localities only, ~79 records for described species) provides a meaningful demo if full curation is not complete by that date.
