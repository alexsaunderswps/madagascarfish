---
# -------------------------------------------------------------------------
# Metadata — identifies the species and the record. Required fields marked *
# -------------------------------------------------------------------------
scientific_name: ""          # * e.g. "Paretroplus menarambo"
provisional_name: ""         # For undescribed morphospecies: "'manombo'" — blank for described
common_name_primary: ""      # e.g. "Pinstripe Damba"

status:
  iucn: ""                   # Informational mirror; actual source is ConservationAssessment
  cares: ""                  # "CCR" | "priority" | "monitored" | ""
  shoal_priority: false      # boolean

# -------------------------------------------------------------------------
# Water parameters — ranges preferred over single values
# -------------------------------------------------------------------------
water:
  temperature_c_min: null    # numeric °C, e.g. 22
  temperature_c_max: null    # e.g. 27
  ph_min: null               # e.g. 6.5
  ph_max: null               # e.g. 7.8
  hardness_dgh_min: null     # e.g. 4
  hardness_dgh_max: null     # e.g. 12
  hardness_dkh_min: null
  hardness_dkh_max: null
  flow: ""                   # "still" | "gentle" | "moderate" | "strong"
  notes: ""                  # e.g. "Tolerates seasonal pH drift; avoid RO-pure water"

# -------------------------------------------------------------------------
# Tank / system
# -------------------------------------------------------------------------
tank:
  minimum_volume_liters: null   # numeric L, e.g. 200
  minimum_footprint_cm: ""      # e.g. "120x45"
  aquascape: ""                 # "heavily planted" | "open water" | "rockwork with caves" etc.
  substrate: ""                 # "fine sand" | "gravel" | "bare bottom for fry"
  cover: ""                     # "driftwood + overhangs" | "dense plants" | etc.
  notes: ""                     # "Needs a territory break every 30cm for subdominants"

# -------------------------------------------------------------------------
# Diet
# -------------------------------------------------------------------------
diet:
  accepted_foods: []            # list, e.g. ["frozen bloodworm", "high-quality pellet", "blanched zucchini"]
  live_food_required: false     # true if won't thrive on prepared foods alone
  feeding_frequency: ""         # "once daily" | "2x daily, small amounts" | etc.
  notes: ""

# -------------------------------------------------------------------------
# Behavior & social structure
# -------------------------------------------------------------------------
behavior:
  temperament: ""               # "peaceful" | "mildly territorial" | "aggressive to conspecifics"
  recommended_sex_ratio: ""     # e.g. "1M:3F" | "single pair" | "species-only"
  schooling: ""                 # "loose group ≥6" | "pair-bonding" | "solitary"
  community_compatibility: ""   # "good with peaceful tetras" | "species-only recommended"
  notes: ""

# -------------------------------------------------------------------------
# Breeding
# -------------------------------------------------------------------------
breeding:
  spawning_mode: ""             # "substrate-spawner" | "mouthbrooder" | "annual/killi" | "bubble-nest"
  triggers: ""                  # "temperature drop + heavy water change" | "seasonal photoperiod" | etc.
  egg_count_typical: ""         # e.g. "80-200"
  fry_care: ""                  # "biparental" | "maternal mouthbrooding" | "none — remove adults"
  survival_bottlenecks: ""      # "first-feeding — needs live microfauna for 10-14 days"
  notes: ""

# -------------------------------------------------------------------------
# Difficulty factors — SURFACE WHY, NOT A SINGLE LABEL
# Fill in whichever factors apply; leave the rest blank. The UI composes these
# into a natural-language summary, so be honest and specific.
# -------------------------------------------------------------------------
difficulty_factors:
  adult_size: ""                # "small (<10cm)" | "medium (10-20cm)" | "large (>20cm)"
  space_demand: ""              # "modest" | "substantial" | "species-tank only"
  temperament_challenge: ""     # "peaceful" | "intraspecific aggression during breeding" | etc.
  water_parameter_demand: ""    # "forgiving" | "moderate" | "demanding — stable soft water required"
  dietary_specialization: ""    # "generalist" | "live-food dependent" | etc.
  breeding_complexity: ""       # "spontaneous in-tank" | "requires conditioning + trigger" | "very difficult in captivity"
  other: ""                     # anything else a prospective keeper should weigh

# -------------------------------------------------------------------------
# Sourcing (the block itself is rendered from a shared component;
# this field captures species-specific notes, e.g. active CARES priority)
# -------------------------------------------------------------------------
sourcing:
  cares_registered_breeders: true    # is this species in active CARES/Citizen Conservation circulation?
  notes: ""                          # e.g. "Available via CARES BAP network; contact breeder coordinator for F1 stock"

# -------------------------------------------------------------------------
# Sources — at least one required to publish
# -------------------------------------------------------------------------
sources:
  - label: ""                   # human-readable citation
    url: ""                     # optional

# -------------------------------------------------------------------------
# Governance
# -------------------------------------------------------------------------
contributors: ""                # free text at MVP; structured post-MVP
last_reviewed_by: ""            # User username or ORCID — resolved to User FK at load time
last_reviewed_at: ""            # YYYY-MM-DD
---

# Narrative

Write 2–5 short paragraphs here. This is the voice-of-a-keeper content — what
it is like to actually keep this species. Cover whatever feels most useful: a
story about first breeding, a habitat observation that changed your setup, a
common failure mode and how to avoid it. Stay out of SOP territory — this is
guidance, not a protocol.

Keep paragraphs short. Use plain language. Avoid jargon where possible; where
jargon is unavoidable (e.g. "leucistic," "riverine spawner"), assume a
hobbyist-intermediate reader and briefly gloss on first use.
