# BA Assessment — Institution-Scoped Editing for Population Data

**Author:** BA pass (drafted with Aleksei, 2026-05-01)
**Status:** Proposed for pre-workshop delivery
**Workshop deadline:** ECA Workshop, ABQ BioPark, June 1–5, 2026
**Time available:** ~30 days

---

## TL;DR

Let Tier 2 users associated with an institution directly edit the
`ExSituPopulation` records they own — counts, sex ratios, breeding status,
last-census date, notes. Coordinator/Tier 3+ retains the system-wide view and
remains the only path for transfers, breeding recommendations, and
cross-institution coordination.

The motivating use case is CARES priority-species keepers: hobbyist breeders
and small-institution staff whose participation in the platform should feel
like contribution, not just consumption. Letting them maintain their own
holdings data is the lightest-weight way to express that.

---

## Why this belongs (alignment with platform mission)

`CLAUDE.md` lists CARES priority lists and hobbyist breeding programs (CARES,
Citizen Conservation) as in-scope for the platform's institution model. The
ideation docs frame the platform's value as *coordination*, which requires
breeders to see their data live in the same surface coordinators use. A
read-only experience for keepers — "your data is up there, but only the
coordinator can update it" — undercuts the participation ask.

Coordinator-mediated editing is the right default for *cross-institution*
data (transfers, recommendations). It's the wrong default for *intra-
institution* data (your own population's count last week). The current model
collapses both into a Tier 3+ bottleneck, which we now have evidence will
not scale: pre-workshop outreach to CARES species holders presumes a
contribution loop, and that loop has to be self-service to be credible.

---

## Scope (what's in)

**In scope — direct edit by Tier 2 institution staff:**

- `ExSituPopulation.count_total`
- `ExSituPopulation.count_male` / `count_female` / `count_unsexed`
- `ExSituPopulation.breeding_status` (`breeding` / `non-breeding` / `unknown`)
- `ExSituPopulation.last_census_date`
- `ExSituPopulation.notes`
- `ExSituPopulation.studbook_managed` (boolean, low risk)

**In scope — supporting work:**

- `InstitutionScopedPermission` DRF permission class.
- Institution-claim flow (a user requesting to be associated with an
  institution; coordinator/admin approves). See "open question 1".
- A minimal Tier 2 dashboard surface — `/dashboard/institution` — that lists
  the user's institution's populations and links to an edit form for each.
- Audit hooks: extend `audit.AuditEntry` to cover `ExSituPopulation`
  field-level changes by Tier 2 actors.

**Out of scope — explicitly:**

- `Transfer` editing (stays Tier 3+ — both institutions and coordination
  semantics).
- `BreedingRecommendation` editing (Tier 3+ only — coordinator output).
- `BreedingEvent` editing (defer; the model has parent/offspring linkages
  that need their own UX pass).
- `HoldingRecord` (sub-record granularity — defer; population-level edits
  cover the keeper-participation story).
- `CoordinatedProgram` (Tier 3+; institution staff are participants, not
  editors).
- Field programs / occurrence records (separate domain).

The "feel part of something bigger" outcome is satisfied by the in-scope
list. The out-of-scope list represents real complexity we should not absorb
in 30 days.

---

## Existing platform foundation

What's already there:

| Asset | Where | Role in this gate |
|-------|-------|-------------------|
| `User.institution` FK | `backend/accounts/models.py:58` | Identity → institution mapping |
| `User.access_tier` | `backend/accounts/models.py:53` | Tier 2 default for new signups |
| `TierPermission` factory | `backend/accounts/permissions.py:9` | Pattern to extend with `InstitutionScopedPermission` |
| `RegisterSerializer.institution_id` | `backend/accounts/serializers.py` | Already accepts an institution claim at signup |
| `ExSituPopulation.institution` FK | `backend/populations/models.py:57` | The ownership pivot |
| `audit.AuditEntry` | `backend/audit/models.py` | Append-only audit table; needs scope expansion |
| `/dashboard/coordinator/` | `frontend/app/[locale]/dashboard/coordinator/` | Pattern to clone for institution dashboard |

What's missing:

- A permission class that says "Tier 2+ AND `obj.institution == request.user.institution`".
- Write endpoints on `ExSituPopulation` (currently `ReadOnlyModelViewSet` in `backend/populations/views.py`).
- An institution-claim approval workflow.
- A Tier 2 institution dashboard frontend.
- Extension of audit coverage beyond conservation-status governance.

---

## Stakeholders

- **CARES keepers / hobbyist breeders** — the primary target users. Want
  agency over their own data; do not want to email a coordinator to update a
  count.
- **Small-institution staff** (zoos, aquariums beyond Tier 3 coordinators) —
  same need, different scale.
- **Coordinators (Tier 3+)** — gain accuracy (data is fresher), lose direct
  control. Need confidence that institution edits are auditable and that
  obvious-error conditions surface.
- **Aleksei (platform operator)** — gains a credible workshop story
  ("keepers can already edit their own data"); takes on operational
  responsibility for the institution-claim approval queue at first.
- **Workshop reviewers / SHOAL partnership conversation** — the demo target.
  An institution-staff edit, live, on the workshop demo, is a strong
  artifact.

---

## Stories

### S1 — Institution staff sign up and request institution association

**As a** CARES keeper at Aquarium X
**I want to** sign up with my email and select Aquarium X as my institution
**So that** my account is queued for institution-association approval
without giving me edit access immediately.

Acceptance:
- Signup form lets the user select an institution from a searchable
  list, or "I am not affiliated with a listed institution" (Tier 2, no
  edit access).
- The selection lands as a *pending* institution claim — `User.institution`
  remains NULL until approved.
- The user receives a confirmation email noting that institution
  membership is pending coordinator approval.

### S2 — Coordinator approves institution claims

**As a** Tier 3+ coordinator
**I want to** see pending institution claims in a Django admin list (or a
small admin page)
**So that** I can approve genuine staff and reject impostors.

Acceptance:
- Pending claims are visible in a single admin list view, sortable by
  request date, filterable by institution.
- Approving sets `User.institution = <claim.institution>` and grants
  edit permission via the new permission class.
- Rejecting clears the pending claim and notifies the user (templated
  email).

### S3 — Institution staff see their dashboard

**As a** Tier 2 user with an approved institution membership
**I want to** see a `/dashboard/institution/` page listing my institution's
`ExSituPopulation` records
**So that** I can find the population I want to edit.

Acceptance:
- Page shows scientific name, common name, count_total, last_census_date,
  breeding_status, and an "Edit" affordance.
- Page is gated on Tier 2+ AND `user.institution IS NOT NULL`.
- Empty state ("no populations attached to your institution yet")
  links to a contact-the-coordinator path.

### S4 — Institution staff edit their population data

**As a** Tier 2 user with an approved institution membership
**I want to** edit count_total / count_male / count_female / count_unsexed
/ breeding_status / last_census_date / notes / studbook_managed on the
populations my institution owns
**So that** the platform reflects current reality without my needing to
email a coordinator.

Acceptance:
- The edit form rejects the request if the population's institution does
  not match the user's institution (server-enforced via
  `InstitutionScopedPermission`).
- Successful edits write an `AuditEntry` with `actor_user`, before/after
  values, and timestamp.
- Edit failures (validation errors) preserve form state and explain the
  problem.
- The Tier 3 coordinator dashboard reflects the edit on its next render
  (no caching divergence).

### S5 — Coordinator dashboard shows last-edit attribution

**As a** Tier 3+ coordinator viewing the population list
**I want to** see who last edited each population and when
**So that** I can tell stale data from fresh institution-reported data.

Acceptance:
- Each row in the coordinator dashboard population list shows
  "last edited: <Institution Name> staff, <timestamp>" or
  "last edited: <coordinator name>, <timestamp>" or "never".
- The attribution comes from the `AuditEntry` history.

### S6 — Audit log captures institution edits

**As a** platform operator
**I want** every Tier 2 institution edit to land in `AuditEntry` with
field-level before/after
**So that** we can reconstruct any change and identify bad-faith edits.

Acceptance:
- Editing any in-scope `ExSituPopulation` field as Tier 2 writes one
  `AuditEntry` per field changed (or one row with multi-field JSON;
  decision goes to the architecture pass).
- Audit rows are visible in Django admin, filterable by `target_type`,
  `actor_user`, and `institution`.

---

## Push-back / risks (honest)

These are concerns the BA wants on the table before the PM scopes a gate.

### R1 — Trust at the front door (the real blocker)

The permission class is easy. The hard part is **how does a user prove
they actually work at Institution X?** Three options:

1. **Coordinator approval queue (recommended).** Manual, low-tech, fits
   the existing platform-operator workload. Aleksei (or a Tier 3
   coordinator) eyeballs each claim before granting edit access.
2. **Email-domain matching.** Auto-approve if `user.email` ends with a
   known institution domain (`@torontozoo.ca`). Doesn't work for CARES
   hobbyists (gmail). Out.
3. **Invite codes.** Coordinators issue codes; users redeem at signup.
   Lower friction at scale but more plumbing now.

For the workshop, option 1 is the only realistic path. Aleksei can review
in-band. Option 3 is a logical follow-up after the workshop.

### R2 — Workshop demo blast radius

If a keeper edits a count incorrectly during the live demo, the bad data
is live on the platform. Mitigations:

- The audit log makes the "rollback" path two-button.
- The coordinator dashboard's "last edited" attribution (S5) makes
  divergence visible immediately.
- We can pre-stage approved demo institutions and seed test populations
  on staging, then promote on demo day.

Net: real but manageable. The upside (live edit-as-keeper demo) is worth
the risk.

### R3 — "Edit with no review" is a higher trust posture than gate-10

Gate-10 (deferred) was a queue: anonymous submission → coordinator
approval. This proposal flips that for institution-owned data: approved
staff edit directly, no queue. This is correct for population counts
(institutions are authoritative on their own holdings) but it's a real
shift in the platform's editing model. We're not extending gate-10 —
we're shipping a parallel pattern.

### R4 — Coordinator-dashboard surprise

The coordinator dashboard currently assumes population data was last
touched by a coordinator. After this gate, it might have been touched by
institution staff. Coordinators need a "last edited by" indicator (S5);
without it, their mental model of the dashboard becomes wrong.

### R5 — Audit scope expansion

`AuditEntry` is currently scoped to conservation-status governance —
`Species.iucn_status` mirror writes and `ConservationAssessment` rows.
Extending it to `ExSituPopulation` is clean (the table is generic), but
the existing admin filters and the existing `actor_type` enum may need
adjustment. Architecture should validate before PM splits stories.

### R6 — Studbook-managed flag

`studbook_managed` is in-scope but is the one boolean that institutions
arguably should *not* unilaterally toggle — it has implications for
program-level reporting. Leave editable for MVP; flag for revisit if
coordinators report misuse.

### R7 — `BreedingEvent` *not* in scope is a deliberate choice

Aleksei's request mentioned "breedings" — I read this as the
`breeding_status` field on `ExSituPopulation` (a single enum), which is
in scope. `BreedingEvent` (the separate model with parent/offspring
linkages) is out of scope this gate. If keepers want to log
individual breeding events, that's a richer UI problem and worth its
own gate post-workshop. Confirm interpretation before architecture.

---

## Open questions

1. **Institution claim approval — Django admin only, or a small dashboard
   page?** Django admin is the path of least resistance pre-workshop. A
   dedicated coordinator-dashboard tab is cleaner long-term.
2. **Does the institution dashboard show *any* aggregate data
   (cross-institution averages, "your institution's contribution to
   Species X's known captive population")?** Strong "feel part of
   something bigger" lever. Recommend yes, lightweight.
3. **Email notification on coordinator approval / rejection?** Yes for
   approval ("you can now edit X populations"); rejection email needs
   careful copy.
4. **Should the dashboard show populations across the user's
   institution, or only ones they're explicitly listed on?** Current
   recommendation: institution-wide. A multi-keeper institution should
   not have to designate a primary editor.
5. **Edit conflicts:** if two institution staffers open the same edit
   form, last-write-wins or optimistic locking? Recommend last-write-
   wins at MVP with audit trail; revisit if it becomes a problem.
6. **Tier downgrade path:** if a coordinator revokes an institution
   claim, what happens to past edits? They stay (audit trail intact);
   the user loses prospective edit access. Document explicitly.

---

## Acceptance criteria for this assessment

This BA assessment is *complete* when the following are explicit and
locked:

- [ ] Aleksei confirms the in-scope / out-of-scope split.
- [ ] Aleksei confirms institution-claim approval is coordinator-manual
      (option 1 from R1).
- [ ] Aleksei confirms `BreedingEvent` is deferred (R7).
- [ ] Architecture pass validates audit-table extension (R5) before
      PM splits stories.
- [ ] PM splits this into a gate spec with story sequencing — likely a
      single gate but possibly two if the institution-claim flow grows
      (S1+S2 ahead, S3–S6 after).

---

## Workshop-readiness lens

Today: 2026-05-01. Workshop opens: 2026-06-01.

Hard demo asks if this gate ships:

1. A pre-staged Tier 2 keeper account at a real CARES-priority
   institution.
2. That account logs in live, navigates to `/dashboard/institution`,
   updates a count or breeding status, and the change is visible on the
   coordinator dashboard within seconds.
3. The "last edited by Institution X staff" attribution shows up on the
   coordinator dashboard.
4. The audit log shows the edit in Django admin.

That's the four-step demo. None of those four require `BreedingEvent`,
`Transfer`, or `HoldingRecord` editing. The minimum viable cut hits the
"feel part of something bigger" message with the smallest possible new
surface.

---

## Recommended next step

Architecture pass on (a) `InstitutionScopedPermission` design, (b) the
audit-table extension to cover `ExSituPopulation`, and (c) where the
institution-claim queue lives (admin vs. coordinator-dashboard tab).
After that, PM splits a single gate spec — provisionally
`gate-12-institution-scoped-editing.md`.
