---
gate: 13
title: Institution-Scoped Editing — Tier 2 Population Edits, Claim Queue, Audit Hook
status: Not started
preconditions:
  - BA assessment locked (`docs/planning/business-analysis/institution-scoped-editing.md`).
  - Architecture pass locked (`docs/planning/architecture/institution-scoped-editing.md`, decisions D1–D12).
  - Permission-class sketch reviewed (`docs/planning/business-analysis/institution-scoped-editing-permission-sketch.md`, 11 cases + arch additions 12–14).
  - Gate 11 (Auth MVP) shipped — `NEXT_PUBLIC_FEATURE_AUTH` is live, `getServerDrfToken()` / `getServerTier()` are available, `/me/` exists and is the tier-truth surface.
  - L4 i18n shipped — `send_translated_email()`, branded base template, `User.locale`, server-action localization pattern all in place.
  - `audit.AuditEntry` exists from Gate 06b governance work; `audit_actor()` thread-local context manager is the attribution surface.
unlocks:
  - The four-step ABQ demo: Tier 2 keeper logs in → edits a count on `/dashboard/institution` → coordinator dashboard shows fresh "last edited by Institution X staff" attribution → audit log shows the edit in Django admin.
  - A reusable institution-scoped-edit pattern (`InstitutionScopedPermission` + `actor_institution` audit snapshot + denormalized last-edit columns) for future auditable models — `Transfer`, `BreedingRecommendation`.
  - Coordinator-dashboard tab for the institution-claim approval queue (post-MVP fast-follow on top of the admin-only path that ships here).
  - User-level audit signal coverage (post-MVP, R-arch-1).
branch: gate/13-institution-scoped-editing
deadline: 2026-06-01 (ECA Workshop, ABQ BioPark — flag-gated on `NEXT_PUBLIC_FEATURE_AUTH` so a bad regression can't take the public site with it)
input:
  - docs/planning/business-analysis/institution-scoped-editing.md (locked)
  - docs/planning/architecture/institution-scoped-editing.md (locked, D1–D12)
  - docs/planning/business-analysis/institution-scoped-editing-permission-sketch.md (sketch + 11 test cases)
  - backend/accounts/models.py (touched — add `PendingInstitutionClaim`)
  - backend/accounts/permissions.py (touched — add `InstitutionScopedPermission`)
  - backend/accounts/serializers.py (touched — extend `UserProfileSerializer`, change `RegisterSerializer` claim path)
  - backend/accounts/views.py (touched — approval / rejection endpoints, optional)
  - backend/accounts/admin.py (touched — `PendingInstitutionClaimAdmin`)
  - backend/audit/models.py (touched — `actor_institution` FK)
  - backend/populations/models.py (touched — `last_edited_*` + `updated_at` columns)
  - backend/populations/views.py (touched — `ExSituPopulationViewSet` write surface + `perform_update` audit hook)
  - backend/populations/serializers.py (touched — `ExSituPopulationWriteSerializer`, list-serializer `last_edited_by` block)
  - frontend/app/[locale]/dashboard/institution/* (new)
  - frontend/lib/institutionDashboard.ts (new)
  - frontend/middleware.ts (touched — gate `/dashboard/institution`)
  - frontend/components/NavLinks.tsx (touched — surface "Institution dashboard" link when membership approved)
---

# Gate 13 — Institution-Scoped Editing

## Goal

Let Tier 2 institution staff (CARES keepers, small-institution staff, hobbyist breeders) directly edit the `ExSituPopulation` records owned by their own institution — counts, sex ratios, breeding status, last-census date, notes, `studbook_managed`. Coordinator-mediated editing remains the right default for cross-institution data (transfers, recommendations); this gate carves out *intra*-institution data as self-service and ships the supporting plumbing: a `PendingInstitutionClaim` queue, an `InstitutionScopedPermission` DRF class, an audit hook with institution snapshotting, denormalized last-edit columns on `ExSituPopulation`, a `/me/` extension, a Tier 2 institution dashboard, and "last edited by" attribution on the existing coordinator dashboard.

The load-bearing scope test for every decision in this spec is the four-step ABQ demo (BA §"Workshop-readiness lens"): a pre-staged keeper account logs in, edits a count, the coordinator dashboard reflects the edit with attribution, the audit log shows the row. Anything not on that path is a candidate for the §"Workshop-Readiness Cuts" list.

This gate ships behind `NEXT_PUBLIC_FEATURE_AUTH` (the existing Gate 11 flag) so the institution dashboard inherits the same kill switch as the rest of the auth surface. No new feature flag.

## Stories

- **Story 13.1** — As a CARES keeper at Aquarium X, I want to sign up with my email and select Aquarium X as my claimed institution, so that my account is queued for institution-association approval without giving me edit access immediately. (BA S1.)
- **Story 13.2** — As a Tier 3+ coordinator, I want to see pending institution claims in Django admin and approve or reject them with optional review notes, so that I can grant edit access to genuine staff and record a rejection reason for impostors. (BA S2.)
- **Story 13.3** — As a Tier 2 user with an approved institution membership, I want a `/dashboard/institution/` page listing my institution's `ExSituPopulation` records, so that I can find the population I want to edit. (BA S3.)
- **Story 13.4** — As a Tier 2 user with an approved institution membership, I want to edit `count_total` / `count_male` / `count_female` / `count_unsexed` / `breeding_status` / `last_census_date` / `notes` / `studbook_managed` on my institution's populations, so that the platform reflects current reality without my needing to email a coordinator — and every edit must write a single `AuditEntry` row capturing all changed fields with an institution snapshot. (BA S4 + S6 reconciled per architecture D2.)
- **Story 13.5** — As a Tier 3+ coordinator viewing the existing stale-census panel, I want to see who last edited each population and when, so that I can tell stale data from fresh institution-reported data. (BA S5.) **Most-cuttable scope item — see §Workshop-Readiness Cuts.**
- **Story 13.6** — As a platform operator, I want every Tier 2 institution edit to land in `AuditEntry` as a single multi-field-JSON row with `actor_user`, `actor_institution` snapshot, before/after JSON, and timestamp, so that I can reconstruct any change and identify bad-faith edits — and the audit row stays attributable even if the user's `User.institution` is later cleared or reassigned. (BA S6 + architecture D2/D3.)

## Story Execution Order

The implementer should land work in this order. Each story is a logical commit (or commit cluster) on `gate/13-institution-scoped-editing`. Backend foundations first so the perm class and audit shape are testable in isolation; frontend last so the UI is wired against a stable API; the coordinator-dashboard `last_edited_by` column at the very end because it's the most-cuttable item if 30 days proves tight.

1. **Story 13.6 (audit hook + columns).** Backend foundation. Add `actor_institution` FK on `AuditEntry`, the four denormalized `last_edited_*` / `updated_at` columns on `ExSituPopulation`, migrations 2 and 3 from §Migrations. No write surface yet; this is the audit shape.
2. **Story 13.2 (claim queue + admin).** Backend. Add `PendingInstitutionClaim` model + `PendingInstitutionClaimAdmin` with `approve_selected` / `reject_selected` actions, internal `approve_claim()` / `reject_claim()` service functions, optional REST endpoints behind `TierPermission(3)`. Migration 1 from §Migrations. Approval / rejection emails using `send_translated_email()`.
3. **Story 13.1 (signup → claim).** Backend. Change `RegisterSerializer` so `institution_id` lands as a `PendingInstitutionClaim(status=PENDING)` row instead of setting `User.institution` directly. Email confirmation noting pending review.
4. **Story 13.4 (write surface + perm class + audit hook).** Backend. Add `InstitutionScopedPermission` factory, convert `ExSituPopulationViewSet` to `ModelViewSet` (or add a focused `UpdateAPIView` — see §Implementation Notes), add `ExSituPopulationWriteSerializer`, attach perm class, implement `perform_update` audit hook + atomic last-edited-column update. This is when `PATCH` becomes a real verb on the API.
5. **`/me/` extension.** Backend. Extend `UserProfileSerializer` with the `institution_membership` block per architecture §6.1. The frontend can't render the right state without this.
6. **Story 13.3 (institution dashboard list view).** Frontend. New `frontend/app/[locale]/dashboard/institution/page.tsx`, `frontend/lib/institutionDashboard.ts` fetcher, middleware-gating in `frontend/middleware.ts`, page-level claim-status gating, `NavLinks` surfaces the link when session indicates approved membership.
7. **Story 13.4 (frontend edit form).** Frontend. New `frontend/app/[locale]/dashboard/institution/populations/[id]/edit/page.tsx` + server-action save, account page surfaces claim status block.
8. **Story 13.5 (coordinator dashboard last-edited column).** Frontend + small backend serializer change. Surface `last_edited_by` on the existing stale-census panel. **Cuttable** — see §Workshop-Readiness Cuts. If cut, surface to Aleksei before shipping.

## Scope Assessment

| Story | Frontend | Backend | Full-Stack | Complexity |
|-------|----------|---------|------------|------------|
| 13.1 |   | ✓ |   | S |
| 13.2 |   | ✓ |   | M |
| 13.3 |   |   | ✓ | M |
| 13.4 |   |   | ✓ | L |
| 13.5 |   |   | ✓ | S |
| 13.6 |   | ✓ |   | M |

Story 13.4 is the largest single chunk: write surface conversion of the viewset, the new write serializer, the perm class, the audit hook, and the edit-form server action all live here. Plan to split it into reviewable commits (perm-class + viewset, then audit hook, then frontend form).

## Data Model

### `PendingInstitutionClaim` (new — `backend/accounts/models.py`)

Per architecture §3.3. New model, **not** flat fields on `User`, so claim history survives re-claim and rejection. Production has no real users yet, so the migration backfill is belt-and-suspenders for staging seed data.

```python
class PendingInstitutionClaim(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        APPROVED = "approved"
        REJECTED = "rejected"
        WITHDRAWN = "withdrawn"

    user = ForeignKey(AUTH_USER_MODEL, on_delete=CASCADE, related_name="institution_claims")
    institution = ForeignKey("populations.Institution", on_delete=CASCADE, related_name="pending_claims")
    status = CharField(max_length=20, choices=Status.choices, default=PENDING, db_index=True)
    requested_at = DateTimeField(auto_now_add=True)
    reviewed_at = DateTimeField(null=True, blank=True)
    reviewed_by = ForeignKey(AUTH_USER_MODEL, on_delete=SET_NULL, null=True, blank=True,
                             related_name="institution_claims_reviewed")
    requester_note = TextField(blank=True, default="")
    review_notes = TextField(blank=True, default="")

    class Meta:
        ordering = ["-requested_at"]
        constraints = [
            UniqueConstraint(fields=["user", "institution"],
                             condition=Q(status="pending"),
                             name="one_pending_claim_per_user_institution"),
        ]
```

Lifecycle:
- **Signup with `institution_id`** → creates `PendingInstitutionClaim(status=PENDING)`. `User.institution` stays NULL.
- **Approval** → atomically: `User.institution = claim.institution`, `claim.status = APPROVED`, `reviewed_at = now`, `reviewed_by = coordinator`. Wrapped in `audit_actor(user=coordinator, reason="institution claim approval")`.
- **Rejection** → `claim.status = REJECTED`, `review_notes` captured. `User.institution` stays NULL. Email sent.
- **Withdrawn** → user-initiated cancellation of their own pending claim. Out-of-scope for MVP per §Workshop-Readiness Cuts; the status value exists in the enum so the schema doesn't churn when withdraw lands post-workshop.

### `AuditEntry` additions (`backend/audit/models.py`)

Per architecture §4.2. One new column:

```python
actor_institution = ForeignKey("populations.Institution", on_delete=SET_NULL,
                                null=True, blank=True, related_name="+")
```

Forensic value: snapshots the user's institution at edit time so later `User.institution` reassignment doesn't obscure history. Existing rows backfill NULL (correct — they're conservation-status governance, not institution-scoped).

`AuditEntryAdmin` adds `actor_institution` to `list_filter` and `list_display`. No other admin changes.

### `ExSituPopulation` additions (`backend/populations/models.py`)

Per architecture §8.1. Four new columns, denormalized for O(1) "last edited" reads on the coordinator dashboard:

```python
last_edited_at = DateTimeField(null=True, blank=True, db_index=True)
last_edited_by_user = ForeignKey(AUTH_USER_MODEL, on_delete=SET_NULL,
                                  null=True, blank=True, related_name="+")
last_edited_by_institution = ForeignKey(Institution, on_delete=SET_NULL,
                                         null=True, blank=True, related_name="+")
updated_at = DateTimeField(auto_now=True)  # general freshness signal, separate from edit attribution
```

`updated_at` is the always-fresh general signal (set on every save, including imports and admin); `last_edited_*` is set only by the new `perform_update` audit hook so it specifically tracks "who attributed this edit." Backfill leaves the three `last_edited_*` columns NULL ("never edited" UX); `updated_at` backfills to the row's existing `created_at`.

### Audited fields (constant on the viewset, not the model)

```python
AUDITED_FIELDS = (
    "count_total", "count_male", "count_female", "count_unsexed",
    "breeding_status", "last_census_date", "notes", "studbook_managed",
)
```

This is the only list of fields editable by Tier 2 institution staff. The write serializer subsets to exactly these.

## API / Endpoints

All paths are absolute under `/api/v1/`. Locked behavior; do not add fields without revisiting the architecture spec.

### `PATCH /api/v1/populations/<id>/`

- **Permission:** `InstitutionScopedPermission()` (Tier 2+ AND `obj.institution_id == user.institution_id`, OR Tier 3+ override).
- **Serializer:** `ExSituPopulationWriteSerializer` — restricts writable fields to `AUDITED_FIELDS`. Other fields are read-only.
- **Body:** any subset of `AUDITED_FIELDS` plus an optional `_reason` (string, max 1KB at serializer layer).
- **Response 200:** updated `ExSituPopulationDetailSerializer` shape.
- **Response 400:** validation errors per DRF default.
- **Response 403:** Tier 2 user without an approved institution; or `obj.institution != user.institution`.
- **Response 404:** Tier 2 user whose `get_queryset()` filter excludes the row (leak-nothing — see permission sketch §3 cases 3 + 4).
- **Side effects:** writes one `AuditEntry` row per multi-field PATCH (D2); updates `last_edited_at` / `last_edited_by_user` / `last_edited_by_institution` atomically in the same transaction.

`PUT` is allowed by `ModelViewSet` but the frontend never calls it — the edit form sends `PATCH`. If the implementer prefers `UpdateAPIView` over the full `ModelViewSet` to keep the surface narrower, that's fine; the audit-hook contract is identical.

### `POST /api/v1/auth/institution-claims/<id>/approve/`

- **Permission:** `TierPermission(3)`.
- **Body:** `{"review_notes": "..."}` (optional).
- **Response 200:** `{"detail": "claim approved"}`.
- **Side effects:** atomic — sets `User.institution`, flips claim to `APPROVED`, captures `reviewed_at` + `reviewed_by` + `review_notes`. Sends `institution_claim_approved` email via `send_translated_email()` with `fail_silently=True`. Email failure does NOT roll back the approval.
- **Optional for MVP** — admin alone covers the demo. Ship if time permits; otherwise defer per §12.1 of the architecture pass.

### `POST /api/v1/auth/institution-claims/<id>/reject/`

- **Permission:** `TierPermission(3)`.
- **Body:** `{"review_notes": "..."}` (optional but strongly encouraged for the rejection email).
- **Response 200:** `{"detail": "claim rejected"}`.
- **Side effects:** flips claim to `REJECTED`, `User.institution` stays NULL, email sent.
- **Optional for MVP** — same as approve.

### `GET /api/v1/auth/me/`

- **Permission:** authenticated.
- **Response shape additions** (architecture §6.1):

```json
{
  "id": 42,
  "email": "keeper@example.org",
  "name": "Keeper Name",
  "access_tier": 2,
  "institution": null,
  "institution_membership": {
    "institution_id": null,
    "institution_name": null,
    "claim_status": "pending",
    "claim_id": 17,
    "claim_requested_at": "2026-05-02T14:33:00Z",
    "claim_reviewed_at": null,
    "rejection_reason": null
  },
  "is_active": true,
  "date_joined": "2026-05-02T14:30:00Z",
  "locale": "en"
}
```

`claim_status` is one of `none`, `pending`, `approved`, `rejected`, `withdrawn`. `institution_id` is gated on `approved` — frontend only sees an `id` (and therefore only renders edit affordances) once the claim is genuinely approved. `institution_name` is included for `pending` / `rejected` so the frontend can render "your pending claim is for *Aquarium X*" without a second round trip. `rejection_reason` mirrors `review_notes` only when `claim_status == rejected`.

### `POST /api/v1/auth/register/` (existing, behavior change)

- **Body change:** when `institution_id` is provided, the serializer now creates a `PendingInstitutionClaim(status=PENDING)` row instead of setting `User.institution`. `User.institution` stays NULL until a coordinator approves.
- **Response:** unchanged shape; the new claim is implicit and visible via `/me/`.

## Frontend Routes

All under `frontend/app/[locale]/`. All new routes are `force-dynamic` (per §Implementation Notes — locale × auth × institution caching discipline).

### `/dashboard/institution/` (new)

- **File:** `frontend/app/[locale]/dashboard/institution/page.tsx`.
- **Renders:** server-rendered list of the user's institution's `ExSituPopulation` records — scientific name, common name, `count_total`, `last_census_date`, `breeding_status`, "Edit" link.
- **Fetches:** `/api/v1/populations/?institution=<user.institution_id>` via `frontend/lib/institutionDashboard.ts` (new fetcher mirroring `coordinatorDashboard.ts`). `revalidate: 0` whenever a token is present.
- **Empty state:** "No populations attached to your institution yet — contact your coordinator." Link to platform contact email.
- **Gating:** middleware enforces tier+token; page-level reads `/me/` and redirects to `/account` if `claim_status != "approved"`.

### `/dashboard/institution/populations/[id]/edit/` (new)

- **Files:** `frontend/app/[locale]/dashboard/institution/populations/[id]/edit/page.tsx` (server component shell) + `actions.ts` (server action that POSTs the `PATCH`).
- **Renders:** a client-island form with the eight `AUDITED_FIELDS`. Submit button. Inline validation errors.
- **Submits:** server action sends `PATCH /api/v1/populations/<id>/` with the changed-field subset. On success, calls `revalidatePath("/dashboard/institution")` and redirects back to the list.
- **Server-action error localization:** uses the L4 pattern from `frontend/app/[locale]/signup/actions.ts` — `getTranslations("dashboard.institution.edit")` and returns symbolic error tokens that the client island resolves via `t()`.
- **Gating:** same as the list page; server-side enforces ownership via the API's 403/404 response.

### `/account/` (existing, additions)

- Surface the `institution_membership` block: render claim status, institution name, requested/reviewed timestamps, rejection reason (if any). Re-claim affordance for `rejected` and `withdrawn` states is post-MVP per §Workshop-Readiness Cuts.

### `NavLinks` (component, existing — touched)

- When `session` indicates `claim_status == "approved"`, render an "Institution dashboard" link alongside the existing "Coordinator dashboard" link (which only appears for Tier 3+). A user who is BOTH Tier 3+ AND has an approved institution membership sees both links — this is intentional (architecture §7.2).

## Acceptance Criteria

The full Given/When/Then set re-derived from the BA's S1–S6 with sharpening from the architecture pass.

### AC-13.1 — Signup creates a pending claim, not a direct membership

**Given** I am on `/signup` and the auth flag is on
**When** I submit my email, name, password, and select Aquarium X from the institution searchable list
**Then** my `User` row is created with `access_tier=2`, `institution=NULL`
**And** a `PendingInstitutionClaim(user=me, institution=Aquarium X, status=PENDING)` row exists
**And** I receive a verification email via the existing flow
**And** after verifying, my `/me/` response shows `institution_membership.claim_status == "pending"` and `institution_membership.institution_name == "Aquarium X"`
**And** my `/me/` response shows `institution_membership.institution_id == null` (gated on approval).

**Given** I am on `/signup` and select "I am not affiliated with a listed institution"
**When** I submit
**Then** no `PendingInstitutionClaim` row is created
**And** my `/me/` response shows `institution_membership.claim_status == "none"`.

### AC-13.2 — Coordinator approves / rejects in Django admin

**Given** a coordinator (Tier 3+) is logged into Django admin
**When** they navigate to `PendingInstitutionClaimAdmin`
**Then** they see a list of pending claims, sortable by `requested_at`, filterable by `status` and `institution`.

**Given** a coordinator selects a pending claim and runs the `approve_selected` action with optional `review_notes`
**When** the action completes
**Then** in a single transaction: the user's `institution` is set to the claim's institution, the claim's `status` flips to `APPROVED`, `reviewed_at` and `reviewed_by` are populated, and `review_notes` is stored
**And** the user receives an `institution_claim_approved` email in their `User.locale`
**And** the user's next `/me/` response shows `claim_status == "approved"` and a non-null `institution_id`
**And** if the email send fails, the approval still persists (per `fail_silently=True`).

**Given** a coordinator selects a pending claim and runs the `reject_selected` action with `review_notes="not affiliated"`
**When** the action completes
**Then** the claim's `status` flips to `REJECTED`, `User.institution` stays `NULL`
**And** the user receives an `institution_claim_rejected` email in their `User.locale` containing the rejection reason
**And** the user's `/me/` response shows `claim_status == "rejected"` with `rejection_reason == "not affiliated"`.

### AC-13.3 — Approved staff see their institution dashboard

**Given** I am a Tier 2 user with `claim_status == "approved"` for Aquarium X
**When** I visit `/dashboard/institution/`
**Then** I see a list of every `ExSituPopulation` row with `institution = Aquarium X`
**And** each row shows scientific name, common name, `count_total`, `last_census_date`, `breeding_status`, and an "Edit" link
**And** populations from other institutions are not present in the list (queryset-scoped server-side, not just hidden in the UI).

**Given** I am a Tier 2 user with `claim_status != "approved"` (any of `none`, `pending`, `rejected`, `withdrawn`)
**When** I visit `/dashboard/institution/`
**Then** I am redirected to `/account` (page-level guard) and see my claim status surfaced there.

**Given** I am unauthenticated, OR I am Tier 1
**When** I visit `/dashboard/institution/`
**Then** middleware redirects me to `/login?callbackUrl=/dashboard/institution`.

**Given** I am a Tier 2 user with approved membership but my institution has zero `ExSituPopulation` rows
**When** I visit `/dashboard/institution/`
**Then** I see the empty-state copy: "No populations attached to your institution yet — contact your coordinator." with a contact link.

### AC-13.4 — Edit writes a single multi-field audit row with institution snapshot

This AC is the resolution of the BA S4-vs-S6 contradiction. **Single `AuditEntry` row per PATCH, with a multi-field JSON payload** (architecture D2). The S4 wording ("writes an `AuditEntry`") and the S6 wording ("one row with multi-field JSON") agree on this AC.

**Given** I am a Tier 2 user with approved membership at Aquarium X
**And** there is an `ExSituPopulation` row at Aquarium X with `count_total=10, count_male=4, breeding_status="non-breeding"`
**When** I PATCH that row with `{"count_total": 12, "count_male": 5, "breeding_status": "breeding"}` (three changed fields)
**Then** the row's `count_total`, `count_male`, `breeding_status` are updated
**And** exactly **one** new `AuditEntry` row is written with:
  - `target_type == "populations.ExSituPopulation"`
  - `target_id == <row.pk>`
  - `actor_type == USER`
  - `actor_user == me`
  - `actor_institution == Aquarium X` (snapshot from `request.user.institution_id` at write time)
  - `action == UPDATE`
  - `before == {"count_total": 10, "count_male": 4, "breeding_status": "non-breeding"}` (only changed fields)
  - `after == {"count_total": 12, "count_male": 5, "breeding_status": "breeding"}`
  - `reason == ""` (no `_reason` provided)
**And** the row's `last_edited_at`, `last_edited_by_user`, `last_edited_by_institution` are updated atomically in the same transaction
**And** the row's `updated_at` is set by the `auto_now=True` save.

**Given** the same setup
**When** I PATCH with `{"count_total": 12}` and an unchanged-value field `{"count_male": 4}` and an irrelevant key `{"foo": "bar"}`
**Then** exactly one `AuditEntry` is written with `before == {"count_total": 10}` and `after == {"count_total": 12}` (only genuinely-changed fields)
**And** `count_male` is not in the audit row
**And** `foo` is silently dropped (not in the writable fields).

**Given** I PATCH a row but no `AUDITED_FIELDS` actually change
**Then** **no** `AuditEntry` row is written
**And** `last_edited_*` columns are not bumped (no spurious "edited at" timestamps).

**Given** I am a Tier 2 user with approved membership at Aquarium X
**When** I PATCH a population at Aquarium B
**Then** the API returns 404 (queryset-scoped — leak-nothing)
**And** no `AuditEntry` is written
**And** the `ExSituPopulation` row is unchanged.

**Given** I am a Tier 2 user with `institution=NULL` (claim pending, rejected, or none)
**When** I PATCH any population
**Then** the API returns 403
**And** no `AuditEntry` is written.

**Given** I am a Tier 3+ coordinator with `institution=Citizen Conservation`
**When** I PATCH a population at Aquarium X
**Then** the request succeeds (coordinator override)
**And** the `AuditEntry` is written with `actor_user == me`, `actor_institution == Citizen Conservation` (the coordinator's institution at edit time, NOT the population's institution)
**And** `last_edited_by_institution` on the population is set to Citizen Conservation.

### AC-13.5 — Coordinator dashboard shows last-edit attribution

**Given** I am a Tier 3+ coordinator on the existing stale-census panel of `/dashboard/coordinator/`
**When** the panel renders a population row whose `last_edited_by_institution == population.institution`
**Then** the row shows: "Last edited: `<institution_name>` staff, `<UpdatedAgo last_edited_at />`"

**Given** the panel renders a population row whose `last_edited_by_institution` is NULL (never edited via the institution-scoped path)
**Then** the row shows: "Never edited" if `last_edited_at` is NULL, OR "Last edited: coordinator (`<user.email>`), `<UpdatedAgo />`" if a coordinator made the edit (`last_edited_by_institution != population.institution`).

**Given** a Tier 2 user fetches `/api/v1/populations/<id>/` for their own institution
**Then** the response does NOT contain a `last_edited_by` block (gated to Tier 3+ on the list serializer for defense-in-depth — Tier 2 users only see their own institution's rows anyway).

### AC-13.6 — Audit log is the operator's reconstruction surface

**Given** I am the platform operator in Django admin viewing `AuditEntryAdmin`
**When** I filter by `target_type=populations.ExSituPopulation` and `actor_institution=Aquarium X`
**Then** I see every Tier 2 institution edit by Aquarium X staff, in reverse chronological order
**And** each row's `before` and `after` JSON shows the changed fields
**And** if a user's `User.institution` is later cleared or reassigned, the historical audit rows still show the original `actor_institution` (snapshot integrity).

**Given** an `AuditEntry` row was written for a multi-field PATCH
**Then** the `field` column on the row is blank (matches the existing `ConservationAssessment` multi-field convention)
**And** there is exactly one row for the PATCH (not one per changed field).

## Tests

The test-writer agent writes the formal adversarial test plan from this spec after implementation. This section names the surface the test plan must cover. Every test below maps to an AC above or a permission-class case from the sketch + architecture appendix A.

### Permission class — 14 cases

The 11 from `permission-sketch.md` plus architecture additions 12–14 (architecture §5.1, appendix A):

| # | Actor | State | Object | Action | Expected |
|---|-------|-------|--------|--------|----------|
| 1 | Tier 2 | institution=A | population at A | GET | 200 |
| 2 | Tier 2 | institution=A | population at A | PATCH | 200 |
| 3 | Tier 2 | institution=A | population at B | GET | 404 (queryset scoping) |
| 4 | Tier 2 | institution=A | population at B | PATCH | 404 (queryset scoping) |
| 5 | Tier 2 | institution=NULL | any | GET list | 200, empty list |
| 6 | Tier 2 | institution=NULL | any | PATCH | 403 |
| 7 | Tier 3 | institution=A | population at B | PATCH | 200 (coordinator override) |
| 8 | Tier 3 | institution=NULL | population at A | PATCH | 200 |
| 9 | Anonymous | — | any | GET | 401 |
| 10 | Tier 2 | deactivated | population at own institution | PATCH | 403 (`is_active` check) |
| 11 | Tier 1 | — | any | PATCH | 403 (below `min_tier`) |
| 12 | Tier 2 | institution=NULL, has PENDING claim on A | population at A | PATCH | 403 (claim must be approved, not just submitted) |
| 13 | Tier 2 | freshly approved (last 5min), JWT not yet refreshed | population at own institution | PATCH | 200 (perm class reads DB, not JWT) |
| 14 | Tier 2 | institution=NULL (revoked) | population formerly at user's institution | PATCH | 403 |

### Audit hook

- One `AuditEntry` row per multi-field PATCH (not one per field).
- `actor_institution_id` matches `request.user.institution_id` at write time (not the population's institution).
- `before` / `after` JSON contains only genuinely-changed fields.
- A no-op PATCH (no `AUDITED_FIELDS` change) writes no audit row and does not bump `last_edited_*`.
- A coordinator (Tier 3+) edit on another institution's population writes the coordinator's `actor_institution`, not the population's.
- `last_edited_at` / `last_edited_by_user` / `last_edited_by_institution` are updated atomically with the audit-row write (same transaction).
- `updated_at` is bumped by `auto_now=True` on every save (including admin and management commands), but `last_edited_*` is only bumped by the API write path.

### Claim queue

- `RegisterSerializer` with `institution_id` creates a PENDING claim and leaves `User.institution = NULL`.
- `RegisterSerializer` without `institution_id` creates no claim.
- `approve_claim()` is atomic: if any step fails (DB or email), the partial state is rolled back EXCEPT email failure (which is `fail_silently=True` and does not roll back).
- `reject_claim()` does not set `User.institution`.
- The `UniqueConstraint` blocks two simultaneous PENDING claims on the same `(user, institution)` pair; a withdrawn or rejected claim does NOT block a new pending claim.
- `/me/` returns the right `claim_status` for each of the five terminal states (`none`, `pending`, `approved`, `rejected`, `withdrawn`).

### Frontend smoke (Playwright)

- Signup → admin-approve (via Django management command shortcut, not a real coordinator click) → login → `/dashboard/institution/` lists the institution's populations → click "Edit" → submit a count change → coordinator dashboard shows the new "last edited by" attribution → audit row visible in `AuditEntryAdmin`.
- Tier 2 with pending claim hitting `/dashboard/institution/` is redirected to `/account` with claim-status surfaced.
- Tier 2 PATCH attempt against another institution's population (via direct API call from the test, not the UI) returns 404.

### i18n

- `institution_claim_approved` and `institution_claim_rejected` email templates render in English (`User.locale=en`).
- French translation present in `backend/locale/fr/LC_MESSAGES/django.po` if L5 lands before the workshop; English-only is acceptable for the demo (architecture §10.1).
- Server-action errors from the edit form resolve via `getTranslations` (matches the L4 S2 pattern).

## Implementation Notes

Non-obvious choices the implementer needs to know.

### `_reason` is optional, not surfaced as a required form field

Architecture D4. The BA's S4 doesn't require a reason for institution edits. The audit-row column exists (we capture it if sent) but the edit form does not show a "reason for change" input. Rationale: institution edits are routine inventory updates; forcing a reason on every count change would add friction to the very loop we're trying to make frictionless. If a reviewer at the workshop asks why, the answer is: `BreedingEvent` will introduce per-event annotations as a richer pattern post-workshop.

### The audit hook lives in `viewset.perform_update`, not a model signal

Architecture D5. The same `ExSituPopulation.save()` is called by management commands (`load_initial_data`, ZIMS imports), Django admin, and the new viewset. Only the viewset path is "Tier 2 institution edit" — that's the boundary we want to audit. A `post_save` signal would over-attribute and require setting `audit_actor` context in every code path. The viewset is the right boundary.

### Denormalized last-edit columns are written in the same transaction as the audit row

Architecture §4.5 + D9. The `perform_update` body wraps `serializer.save()` in `audit_actor()`, then writes `AuditEntry.objects.create(...)`, then runs `ExSituPopulation.objects.filter(pk=...).update(last_edited_*)`. All three happen inside the request transaction. Don't refactor this into a `post_save` signal "for cleanliness" — the request boundary IS the cleanliness.

### Institution-membership state lives in `/me/`, not the JWT

Architecture §6.3. The NextAuth session keeps `tier` only (the existing Gate 11 contract). `institution_membership` is fetched via SSR `apiFetch("/api/v1/auth/me/", { authToken: getServerDrfToken() })` on the account page and the institution dashboard. Don't add `institution_membership` to the JWT — claim status flips much more often than tier (every approval/rejection), and we want fresh reads. The 5-minute `/me/` refresh in `auth.ts` covers tier-side staleness; institution-membership reads are per-request.

### Middleware gates on tier+token; page gates on claim status

Architecture §7.4. `frontend/middleware.ts` only knows about the JWT — it can check tier and token presence but not `claim_status` (that would require an extra DB round trip per request). So middleware does the cheap check ("Tier 2+ AND authenticated") and the page does the rich check (`claim_status == "approved"`). The API enforces the same rule via `InstitutionScopedPermission`, so a determined user bypassing the page gate still gets a 403/404 from the API. Defense-in-depth.

### Permission class queryset scoping is mandatory

Permission sketch §"Subtle correctness notes" #1. `has_object_permission` only fires on detail / write operations. List views are filtered by `get_queryset()`. The viewset MUST override `get_queryset()` to filter by `institution_id` for Tier 2 users; the perm class alone is not sufficient. This is why test cases 3 + 4 expect 404 (queryset-hidden), not 403.

### Cache discipline

Architecture §9. Two rules from CLAUDE.md combine here:
- Auth rule: any fetch with `authToken` MUST pass `revalidate: 0` or be on a `force-dynamic` page.
- i18n rule: next-intl middleware patches `Vary: Accept-Language`.

The institution dashboard sets `export const dynamic = "force-dynamic"`. The fetcher in `frontend/lib/institutionDashboard.ts` passes `revalidate: 0` whenever a token is present. After a successful PATCH, the server action calls `revalidatePath("/dashboard/institution")`. No new cache hazard.

### `/dashboard/institution` and `/dashboard/coordinator` are siblings — no auto-routing

Architecture §7.1 + 7.2. `/dashboard/` (the public registry overview) is unchanged. Users navigate to the right dashboard via `NavLinks`, not by an auto-route. A Tier 3 coordinator who is also an approved keeper at Citizen Conservation sees both nav links — they can pick the role they want to inspect from. This is a feature, not a bug.

### `studbook_managed` is editable by Tier 2 staff

BA R6 + architecture R-arch-4. In scope; monitor for misuse. If keepers start unilaterally toggling this and breaking program-level reporting, the fix is a serializer-level field-readonly switch keyed on tier — NOT the perm class (which is institution-scope, not field-scope). Out of scope this gate.

### The approve/reject REST endpoints are optional

Architecture §3.5 + §12.1. Django admin actions (`approve_selected`, `reject_selected`) cover the demo. The REST endpoints are forward-compat for a coordinator-dashboard tab that's not in MVP. Ship if time permits; the admin path alone is sufficient.

### `User`-level audit on approval is deferred (R-arch-1)

Architecture §4.6. When a coordinator approves a claim and `User.institution` flips, we don't write a `User`-level `AuditEntry` row (the `User` model isn't audited). The `PendingInstitutionClaim` row's `reviewed_by` / `reviewed_at` / `status` is the trail. This is a known deferral; see §Open Questions.

### Migration backfill for legacy users-with-institution

Architecture §11.1. Production has no real users yet (per `auth-c-d.md` §10), so the data migration that creates synthetic APPROVED claims for existing `User.institution IS NOT NULL` rows is mostly belt-and-suspenders. But staging seed data and dev fixtures DO have such users, so the backfill prevents the `/me/` resolution logic from hitting the "user has institution but no claim row" edge case (architecture §6.2).

## i18n

Two new template pairs in `backend/accounts/templates/accounts/`:

- `institution_claim_approved_subject.txt` + `_body.txt` + `_body.html`
- `institution_claim_rejected_subject.txt` + `_body.txt` + `_body.html`

Both extend `{% extends "email/base.html" %}` (the existing L4 branded layout). Strings wrapped in `{% trans %}` / `{% blocktranslate %}`. New strings added to `backend/locale/en/LC_MESSAGES/django.po` (English source-of-truth) and to the FR/DE/ES placeholder catalogs. French translation lands in the L5 sweep; English-only is fine for the workshop demo.

`send_translated_email()` resolves locale per its existing precedence:
1. Explicit `locale` arg (we don't pass; recipient-preferred is correct).
2. `recipient.locale` (set at signup from `request.LANGUAGE_CODE` per L4 S7).
3. `settings.LANGUAGE_CODE` fallback.

Approval / rejection emails go to the user who submitted the claim — their `User.locale` is the right resolution. Coordinators don't receive these emails (they read the admin / dashboard surfaces).

Server-action errors from the edit form follow the L4 S2 pattern (see `frontend/app/[locale]/signup/actions.ts`): `getTranslations("dashboard.institution.edit")` + symbolic error tokens resolved client-side. Django strings on serializer-level validation use `gettext_lazy as _`. Don't introduce hardcoded English in either pocket — `pnpm i18n:lint-pockets` (CI) catches it.

What's NOT new: `send_translated_email()` itself, the branded base layout, `User.locale`, the `gettext_lazy` discipline. All of that exists from L4.

## Migrations

Three migrations, sequenced per architecture §11.1.

### Migration 1 — `accounts/migrations/00XX_pendinginstitutionclaim.py`

- Adds `PendingInstitutionClaim` model.
- **Data migration:** for every existing `User` with `institution_id IS NOT NULL`, creates a synthetic `PendingInstitutionClaim(user=u, institution=u.institution, status=APPROVED, requested_at=u.date_joined, reviewed_at=u.date_joined, reviewed_by=NULL)`. Production-empty; staging seed + dev fixtures benefit.
- Adds the `UniqueConstraint` for one-pending-claim-per-(user, institution).

### Migration 2 — `audit/migrations/00XX_auditentry_actor_institution.py`

- Adds `actor_institution` FK on `AuditEntry`.
- No backfill — existing rows are conservation-status governance scope, NULL is correct.

### Migration 3 — `populations/migrations/00XX_exsitupopulation_last_edited.py`

- Adds `last_edited_at`, `last_edited_by_user`, `last_edited_by_institution`, `updated_at` columns on `ExSituPopulation`.
- **Data migration:** sets `updated_at = created_at` for existing rows. The three `last_edited_*` columns stay NULL ("never edited" UX).

### Rollout order

1. Deploy backend (all three migrations + viewset write surface + admin) first.
2. Deploy frontend (institution dashboard, account-page claim-status block, coordinator dashboard last-edited column) second.

The frontend can't write before the backend has the perm class and viewset. The backend can be deployed alone without breaking anything (the new endpoints just sit unused, and the new columns are NULL-defaulting). No coupled cutover.

## Workshop-Readiness Cuts

The four-step ABQ demo (BA §"Workshop-readiness lens"):

1. Tier 2 keeper logs in.
2. Edits a count or breeding status on `/dashboard/institution`.
3. Coordinator dashboard shows "last edited by" attribution.
4. Audit log shows the edit in Django admin.

### MUST-HAVE (the demo cannot ship without these)

- `PendingInstitutionClaim` model + Django admin (`approve_selected` / `reject_selected` actions).
- `InstitutionScopedPermission` class + `get_queryset()` scoping.
- `ExSituPopulationViewSet` write surface (PATCH at minimum).
- `perform_update` audit hook writing one row per edit with `actor_institution`.
- `last_edited_at` / `last_edited_by_user` / `last_edited_by_institution` columns on `ExSituPopulation`.
- `/me/` `institution_membership` block (frontend can't render without it).
- `/dashboard/institution/` list view + edit form.
- Approval / rejection emails (English-only is fine for the demo).
- The 14 permission-class test cases.
- Smoke e2e: signup → admin-approve → edit → coordinator dashboard sees attribution.

### Nice-to-have (defer if time is tight, in cut order — most cuttable first)

1. **L5 French translation of the new email templates.** English-only ships if L5 hasn't landed.
2. **Story 13.5 — coordinator-dashboard `last_edited_by` panel column.** This is the most-cuttable spec item. The audit log alone covers demo step 4. Cutting this means the coordinator dashboard does NOT visually surface attribution at workshop time; the operator demonstrates "look at the audit log" instead. **A cut here needs Aleksei's sign-off** because S5 is a stated story.
3. **`/dashboard/institution/` aggregate context block** ("your institution's contribution to Species X's known captive population" — BA open question 2). Pure additional UX.
4. **In-app rejection-with-reason flow** on the account page (re-claim affordance, rejection-reason display). The email already carries the reason; the frontend can be a fast-follow.
5. **Withdraw-claim self-service.** Coordinator can reject in admin instead.
6. **REST endpoints for approve / reject.** Admin alone covers the demo; the endpoints unblock a future coordinator-dashboard tab.
7. **`User`-level audit signal on approval (R-arch-1).** Defer; rely on `PendingInstitutionClaim` history.

### Cut authority

The first cut on this list (L5 French) is the implementer's call. Cuts 2–7 require Aleksei's sign-off. Cut 2 specifically requires explicit acknowledgment because it removes a stated BA story — flag it in the standup if the implementation runs hot.

## Open Questions

Locked decisions are NOT re-litigated here. This list is the open architectural item plus PM-flagged items; everything else (D1–D12, BA scope) is settled.

- **R-arch-1 — User-level audit on approval (architecture §4.6 + §13.1).** When a coordinator approves a claim and `User.institution` flips, we don't write a `User`-level `AuditEntry` row because `User` isn't currently audited. The `PendingInstitutionClaim` row's `reviewed_by` / `reviewed_at` / `status` is the trail. **Aleksei to confirm this is acceptable for forensic reconstruction;** if not, we add `User.institution` to the audit signal scope, which is a small migration but expands gate scope. Recommend deferring to post-workshop.
- **PM-flagged: edit-conflict UX surface (R-arch-2).** Last-write-wins with audit trail is fine for MVP. Optional polish: if the institution dashboard's edit form detects that `last_edited_at` is newer than the time the user opened the form, render a "your edit replaced an earlier change at HH:MM" inline notice. This is optional MVP polish; defer if cut #4 from §Workshop-Readiness Cuts also slips.
- **PM-flagged: approval-email-failure dashboard banner (R-arch-7).** `send_translated_email(..., fail_silently=True)` matches the existing signup pattern. A failed approval email leaves the user approved but unaware. The user discovers their approval on next login when the institution dashboard loads. Optional polish: a one-time dashboard banner "your institution membership was approved on `<date>`" if the user has never logged in since approval. Defer post-workshop.
- **PM-flagged: gate-09 / gate-10 numbering.** The architecture pass labels this Gate 13 (Gate 12 is reserved for the ORCID extension referenced in `auth-c-d.md`). The `docs/planning/specs/README.md` index needs updating to reflect the new gate sequence after this spec lands. PM to add a row to the index in the same PR as this spec.
