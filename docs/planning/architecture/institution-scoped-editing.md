# Architecture — Institution-Scoped Editing for Population Data

**Author:** Architecture pass (drafted 2026-05-01)
**Status:** Proposed for pre-workshop delivery
**Workshop deadline:** ECA Workshop, ABQ BioPark, June 1–5, 2026
**Time available:** ~30 days
**Inputs:**
- `docs/planning/business-analysis/institution-scoped-editing.md`
- `docs/planning/business-analysis/institution-scoped-editing-permission-sketch.md`
- `CLAUDE.md` (Conservation status sourcing, Auth Gate 11, i18n L1–L4)

**Provisional gate label:** **Gate 13** (Gate 12 is reserved for the
ORCID extension referenced in `docs/planning/architecture/auth-c-d.md`).

---

## 1. Scope reaffirmation (locked)

In-scope (per BA, locked by Aleksei):

- Tier 2 institution staff edit `ExSituPopulation` fields:
  `count_total`, `count_male`, `count_female`, `count_unsexed`,
  `breeding_status`, `last_census_date`, `notes`, `studbook_managed`.
- Coordinator-manual claim approval (R1 option 1). No email-domain matching, no invite codes.
- `AuditEntry` extended to cover `ExSituPopulation` field-level edits.
- "Last edited by" attribution on the coordinator dashboard (S5).
- New `/dashboard/institution` surface for Tier 2 institution staff.

Out of scope, not re-litigated: `Transfer`, `BreedingRecommendation`, `BreedingEvent`, `HoldingRecord`, `CoordinatedProgram`, field programs, occurrence records, ORCID-linked institution verification.

The four-step ABQ demo (BA §"Workshop-readiness lens") is the load-bearing scope test for every decision in this doc.

---

## 2. Decision log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | New `PendingInstitutionClaim` model (option 1a). | Preserves claim history; supports multi-claim over time; cleaner audit. |
| D2 | One `AuditEntry` row per write, multi-field JSON (matches sketch). | Cheaper at write, one transaction; matches existing `ConservationAssessment` style. |
| D3 | Capture `actor_institution_id` snapshot on `AuditEntry`. | Defends against later `User.institution` re-assignment; satisfies forensic reconstruction. |
| D4 | `_reason` is **optional** for institution edits, **not surfaced** as a required field on the form for MVP. | BA §S4 doesn't list reason as required; adding it is an unprompted UX cost; keep the column present for future use. |
| D5 | Audit write lives in `viewset.perform_update`, NOT a model `save()` signal — but uses the existing `audit_actor()` thread-local context for attribution. | Signals are wrong here: the same `ExSituPopulation.save()` is hit by data-import management commands, by admin, and by the new viewset; only the viewset path is "Tier 2 institution edit". Service-layer function is overkill for one model. The viewset is the right boundary. |
| D6 | Permission class as sketched; Protocol-based duck typing kept; `coordinator_tier=3`. | Reviewed; refinements in §5. Tier 4/5 distinction is not needed — they ride the coordinator override. |
| D7 | `/me/` extended with a flat `institution_membership` block. | Single read for the account page; no second round trip. Shape in §6. |
| D8 | `/dashboard/institution` lives at `frontend/app/[locale]/dashboard/institution/`. The existing `/dashboard/` landing page is unchanged (it's the public registry overview, not a tier-routed shell). | Two siblings, navigated to explicitly; users land on the right one via header nav, not auto-routing. |
| D9 | Last-edit attribution: **denormalized columns** on `ExSituPopulation` (option 6b). | Renders without a join per row, survives audit-log archival, sets the pattern for future auditable models. |
| D10 | Approval / rejection emails use `send_translated_email()` with the user's `User.locale`. Two new template pairs. | Reuses existing L4 branded layout. Locale resolution already correct. |
| D11 | Migration order: claim model → permission/viewset/audit hook → last-edited columns + backfill. Three migrations, sequenced. | §10. |
| D12 | Workshop-minimum cut: defer the institution dashboard's "aggregate context" panel (BA open question 2) and the rejection-email-with-reason flow. Both are nice-to-have, neither blocks the four-step demo. | §11. |

---

## 3. Claim-queue model — `PendingInstitutionClaim` (D1)

### 3.1 Decision

Add a new `PendingInstitutionClaim` model in `accounts/models.py`, **not** flat fields on `User`.

### 3.2 Reasoning vs the alternative

The BA's option (b) — `User.pending_institution`, `User.institution_approved_at`, `User.institution_claim_status` — collapses claim history into one mutable row. Two failure modes that argue against it:

1. **Re-claim after rejection.** If a user signs up claiming Aquarium X, gets rejected, then later re-claims Citizen Conservation, option (b) silently overwrites the rejection record. We lose the audit trail of "this user previously tried to claim X and was rejected." A coordinator approving the second claim has no signal that the user has been refused before.
2. **Multi-institution affiliation over time.** `User.institution` is a single FK; fine. But a keeper who moves from one program to another should generate a *second* claim, leaving the first row as historical context. A flat-field model can't represent that.

`PendingInstitutionClaim` is also the cleaner surface for the coordinator approval admin (one list view, filterable by `status`) and matches the BA's description of "claims" as discrete events.

### 3.3 Shape

```python
# backend/accounts/models.py (additions)

class PendingInstitutionClaim(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        APPROVED = "approved"
        REJECTED = "rejected"
        WITHDRAWN = "withdrawn"  # user cancelled before review

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="institution_claims",
    )
    institution = models.ForeignKey(
        "populations.Institution",
        on_delete=models.CASCADE,
        related_name="pending_claims",
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True,
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="institution_claims_reviewed",
    )
    requester_note = models.TextField(blank=True, default="")  # user's optional context
    review_notes = models.TextField(blank=True, default="")    # coordinator's note (rejection reason etc.)

    class Meta:
        db_table = "accounts_pendinginstitutionclaim"
        ordering = ["-requested_at"]
        constraints = [
            # Only one PENDING claim per (user, institution) at a time.
            # Approved / rejected / withdrawn can coexist as history.
            models.UniqueConstraint(
                fields=["user", "institution"],
                condition=models.Q(status="pending"),
                name="one_pending_claim_per_user_institution",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} → {self.institution.name} ({self.status})"
```

### 3.4 Lifecycle

- **Signup with `institution_id`.** `RegisterSerializer` already accepts `institution_id`. Today it sets `User.institution` immediately. After this gate: it instead creates a `PendingInstitutionClaim(status=PENDING)` and leaves `User.institution = NULL`. (Migration backfill, §10, handles the existing data shape — but production has no real users yet, per `auth-c-d.md` §10.)
- **Approval.** Coordinator action in Django admin (and a small API endpoint for forward compatibility — see §5.2): atomically set `User.institution = claim.institution`, `claim.status = APPROVED`, `claim.reviewed_at = now`, `claim.reviewed_by = request.user`. Wrapped in `audit_actor(user=coordinator, reason="institution claim approval")` so the resulting `User.institution` change is attributed (we'll extend audit signal coverage to the User model in §4.6 — see scope note).
- **Rejection.** Set `claim.status = REJECTED` plus `review_notes`. `User.institution` stays NULL. Email sent (§9).
- **Withdraw.** User can withdraw their own pending claim via account-page action (Tier 2; not a coordinator surface). Sets `status = WITHDRAWN`. Out-of-scope for MVP if it adds time; see §11.

### 3.5 Coordinator approval surface

Two paths, both shipped:

- **Django admin** — primary. `PendingInstitutionClaimAdmin` with `list_filter = ["status", "institution"]`, custom actions `approve_selected` and `reject_selected`. Approval action prompts for an optional `review_notes` (a Django admin intermediate page, ~15 LoC). This is the coordinator-readable, low-effort path the BA asked for.
- **REST endpoint** at `POST /api/v1/auth/institution-claims/<id>/approve/` and `.../reject/`, gated on `TierPermission(3)`. Used by the institution-claim row on the coordinator dashboard if there's time (otherwise this endpoint is a follow-up; admin alone covers MVP). Admin actions and the API endpoint share the same internal `approve_claim(claim, reviewer, notes)` service function.

The BA's open question 1 ("admin only, or a small dashboard page") is resolved as **admin first, API + dashboard tab as fast-follow if time permits.**

---

## 4. Audit-table extension

### 4.1 Single row, multi-field JSON (D2)

Match the existing `ConservationAssessment` row-level audit pattern: one `AuditEntry` per write, with `before` and `after` as objects whose keys are the changed fields. The `field` column on `AuditEntry` is left blank for multi-field rows (it's already `blank=True, default=""`); this matches how `ConservationAssessment` audit rows are written today.

Per-field rows would multiply audit-log volume by ~8 for an edit that touches all in-scope fields, and the existing admin filter (`field`) already loses utility once per-edit fans out. Keep it consolidated.

### 4.2 Capture `actor_institution_id` (D3)

Add a column on `AuditEntry`:

```python
actor_institution = models.ForeignKey(
    "populations.Institution",
    on_delete=models.SET_NULL,
    null=True, blank=True,
    related_name="+",  # no reverse relation needed
)
```

Populated at write time from `request.user.institution_id`. Forensic value: if a user is later moved from Aquarium X to Citizen Conservation (or `User.institution` is cleared on rejection of a re-claim), the historical edits remain attributable to the institution that made them. Without this column, `audit.actor_user.institution` is the only signal and it's stateful.

This is a minor migration on an empty-ish table (audit currently only contains gate-06b governance rows; small in absolute terms). Backfill leaves the column NULL for existing rows, which is correct — they're not institution-scoped edits.

### 4.3 `_reason` optional (D4)

The BA's S4 doesn't list reason as a required form field. The sketch added `reason=self.request.data.get("_reason", "")` and that stays — if a future admin form (or the API) sends `_reason`, it's recorded; otherwise blank. No required-field constraint at the serializer layer for MVP.

For a workshop-time reviewer asking "why no reason field," the answer is: BreedingEvent will introduce per-event annotations as a richer pattern post-workshop; institution edits are routine inventory updates (the fish-count equivalent of `last_census_date`), and forcing a reason on every count change adds friction to the very loop we're trying to make frictionless.

### 4.4 Where the audit-write call lives (D5)

The sketch puts it in `viewset.perform_update`. **This is correct.** Validating against alternatives:

- **Django signals (`post_save` on `ExSituPopulation`).** Wrong: the same `save()` path is hit by management commands (`load_initial_data`, fixture loading, ZIMS imports) and by admin operator edits. A signal would over-attribute, and the `audit_actor` context would have to be set in every code path, which is the exact foot-gun the existing `AUDIT_STRICT_CONTEXT=False` policy works around. A signal is also harder to opt out of for legitimate non-audited writes (e.g., a backfill task).
- **Model-level `save()` hook.** Same problem; worse, because it's now a model concern, not a request concern.
- **Service-layer function.** Right shape long-term, but for one viewset and one model it's premature abstraction.

The viewset is the right boundary. `perform_update` runs after serializer validation, has the request user in scope, and only fires on the API write path — exactly the surface we want to audit.

### 4.5 Audit hook integration with `audit_actor` context (D5 cont.)

Reuse the existing `audit_actor()` context manager from `audit/context.py` to set attribution. The viewset wraps the save:

```python
# backend/populations/views.py (sketch — final shape in implementation)

from audit.context import audit_actor
from audit.models import AuditEntry
from django.forms.models import model_to_dict

class ExSituPopulationViewSet(viewsets.ModelViewSet):
    AUDITED_FIELDS = (
        "count_total", "count_male", "count_female", "count_unsexed",
        "breeding_status", "last_census_date", "notes", "studbook_managed",
    )

    permission_classes = [InstitutionScopedPermission()]

    def perform_update(self, serializer):
        instance_before = serializer.instance
        before = model_to_dict(instance_before, fields=self.AUDITED_FIELDS)
        reason = self.request.data.get("_reason", "")
        with audit_actor(user=self.request.user, reason=reason):
            instance = serializer.save()
        after = model_to_dict(instance, fields=self.AUDITED_FIELDS)
        changed_keys = [k for k in self.AUDITED_FIELDS if before[k] != after[k]]
        if not changed_keys:
            return instance
        AuditEntry.objects.create(
            target_type="populations.ExSituPopulation",
            target_id=instance.pk,
            actor_type=AuditEntry.ActorType.USER,
            actor_user=self.request.user,
            actor_institution_id=self.request.user.institution_id,
            action=AuditEntry.Action.UPDATE,
            before={k: before[k] for k in changed_keys},
            after={k: after[k] for k in changed_keys},
            reason=reason,
        )
        # Update denormalized last-edited columns (D9). Same transaction.
        ExSituPopulation.objects.filter(pk=instance.pk).update(
            last_edited_by_user_id=self.request.user.pk,
            last_edited_by_institution_id=self.request.user.institution_id,
            last_edited_at=instance.updated_at if hasattr(instance, "updated_at") else timezone.now(),
        )
        return instance
```

Two notes on the snippet:

1. The `audit_actor` context wraps `serializer.save()` but NOT the `AuditEntry.objects.create()` call. The audit-entry create is the explicit write — we don't need the context to attribute it, and putting it inside would duplicate.
2. `ExSituPopulation` doesn't currently have `updated_at`. We'll add that field at the same time as the last-edited columns (D9, §7) so we have a coherent "freshness" signal regardless of audit-row presence.

### 4.6 Auditing the approval / rejection action

Out of full scope this gate, but flagged: when a coordinator approves a claim and `User.institution` flips, we'd ideally write an `AuditEntry` for that. Since `User` is not currently audited, doing this cleanly means extending audit-signal coverage to `User.institution`. For MVP, skip this and rely on `PendingInstitutionClaim.reviewed_by` + `reviewed_at` + `status` as the audit trail for the approval action itself. Track in §11 deferrable.

### 4.7 Audit admin (existing)

`AuditEntryAdmin` already filters on `target_type`, `actor_type`, `action`, `timestamp`. Add `actor_institution` to `list_filter` and `list_display`. No other admin changes.

---

## 5. Permission class — validation of the sketch

### 5.1 Sketch is correct as written. Refinements:

- **Protocol vs base mixin.** Keep the Protocol. The codebase has four models with `institution` FKs (`ExSituPopulation`, `Transfer`, `BreedingRecommendation`, `FieldProgram`); `Transfer` has *two* (`source_institution`, `destination_institution`). A base mixin would either lie about `Transfer` or require a custom `institution_id` property that delegates. The Protocol-based approach already accommodates that variability without dragging the whole hierarchy through a refactor we're not ready to commit to pre-workshop.
- **`coordinator_tier=3` parameterization.** Correct. Tier 4/5 ride the coordinator override, no distinction needed for this gate. If a future feature wants Tier 4-only reads or writes, it can pass `coordinator_tier=4`.
- **`is_active` re-check in `has_object_permission`.** Sketch already has it. Keep it.
- **Test-case matrix (the 11 cases).** Complete for permission-class behavior. Missing cases for the *combination* with `PendingInstitutionClaim`:
  - Case 12: Tier 2 user with a `PendingInstitutionClaim(status=PENDING)` on Aquarium X but `User.institution = NULL` → `PATCH` on Aquarium X population → 403. Already covered implicitly by case 6 (institution=NULL → 403); restate to be explicit about the pending-claim posture.
  - Case 13: Tier 2 user whose claim was approved 5 minutes ago → JWT still has stale `tier` from before approval but `User.institution` is now set → `PATCH` succeeds. The 5-minute `/me/` refresh in `auth.ts` covers the tier-side staleness; the permission class reads `request.user.institution_id` directly from the DB, so it's never stale.
  - Case 14: Tier 2 user whose claim was *revoked* (institution set back to NULL by an admin) — the permission class denies on the next request. The auth `is_active` re-check handles deactivation; institution revocation is a separate signal that the perm class already checks via `user.institution_id is None`.
  - Case 15: A `_reason` field in the request body that's longer than 1KB (notes-field abuse) — out of scope at the perm-class layer, handled at the serializer's `reason` field max length.

Add cases 12–14 to the test plan; case 15 is a serializer-level concern.

### 5.2 Approval API endpoint sketch

```python
# backend/accounts/views.py (additions)

@api_view(["POST"])
@permission_classes([TierPermission(3)])
def approve_institution_claim(request: Request, claim_id: int) -> Response:
    claim = get_object_or_404(PendingInstitutionClaim, pk=claim_id, status="pending")
    notes = request.data.get("review_notes", "")
    with audit_actor(user=request.user, reason="institution claim approval"):
        claim.user.institution = claim.institution
        claim.user.save(update_fields=["institution"])
        claim.status = "approved"
        claim.reviewed_at = timezone.now()
        claim.reviewed_by = request.user
        claim.review_notes = notes
        claim.save()
    send_translated_email(
        recipient=claim.user,
        template="accounts/institution_claim_approved",
        context={"institution": claim.institution, "user": claim.user},
        fail_silently=True,
    )
    return Response({"detail": "claim approved"})
```

The reject endpoint mirrors this with `claim.status = "rejected"` and a different email template. Wire URLs at `/api/v1/auth/institution-claims/<id>/{approve,reject}/`.

---

## 6. `/me/` endpoint extension (D7)

### 6.1 Response shape

Extend `UserProfileSerializer` to include an `institution_membership` block:

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

Five terminal `claim_status` values:

- `none` — user has never submitted a claim, `User.institution` NULL.
- `pending` — most recent claim has `status=pending`.
- `approved` — most recent claim has `status=approved` AND `User.institution` matches.
- `rejected` — most recent claim has `status=rejected`. Frontend renders rejection reason and a re-claim affordance.
- `withdrawn` — most recent claim has `status=withdrawn`. Frontend renders a re-claim affordance.

### 6.2 Resolution logic

```python
def institution_membership_block(user: User) -> dict:
    if user.institution_id and not user.institution_claims.exists():
        # Edge case: legacy user with institution set directly, no claim row.
        # Migration backfill (§10) creates synthetic APPROVED claims to avoid this.
        return {
            "institution_id": user.institution_id,
            "institution_name": user.institution.name,
            "claim_status": "approved",
            "claim_id": None,
            "claim_requested_at": None,
            "claim_reviewed_at": None,
            "rejection_reason": None,
        }
    most_recent = (
        user.institution_claims.order_by("-requested_at").select_related("institution").first()
    )
    if most_recent is None:
        return {"institution_id": None, "institution_name": None, "claim_status": "none", ...}
    return {
        "institution_id": most_recent.institution_id if most_recent.status == "approved" else None,
        "institution_name": most_recent.institution.name,
        "claim_status": most_recent.status,
        "claim_id": most_recent.id,
        "claim_requested_at": most_recent.requested_at.isoformat(),
        "claim_reviewed_at": most_recent.reviewed_at.isoformat() if most_recent.reviewed_at else None,
        "rejection_reason": most_recent.review_notes if most_recent.status == "rejected" else None,
    }
```

`institution_name` is included even for `pending` / `rejected` so the frontend can render "your pending claim is for *Aquarium X*" without a second round trip. `institution_id` is gated on approval to prevent a frontend from leaking edit affordances against an unapproved institution.

### 6.3 Frontend session hydration

The NextAuth `Session` object already has `tier`. We're explicitly **not** putting `institution_membership` on the session — the account page renders this server-side via `apiFetch("/api/v1/auth/me/", { authToken: getServerDrfToken() })`. Adding it to the JWT would mean another stale-cache surface; the 5-minute `/me/` refresh already handles tier staleness, but `institution_membership` flips state much more often than tier (every claim approval/rejection), and we want fresh reads on the account page anyway.

---

## 7. Frontend dashboard composition (D8)

### 7.1 Two siblings, no auto-routing

`/dashboard/` (the existing one) is the public registry overview — the IUCN chart, totals, coverage-gap link. It is **not** a tier-routed shell. Don't change it.

`/dashboard/coordinator/` is the existing Tier-3+ panel surface.

`/dashboard/institution/` is new. Sibling of `/dashboard/coordinator/`. Lives at `frontend/app/[locale]/dashboard/institution/page.tsx`.

Users navigate to the right one via header nav (a `NavLinks` change to surface "Institution dashboard" when the session indicates an approved institution membership). No auto-routing on `/dashboard/`.

### 7.2 What if a Tier 3 coordinator also has an institution claim?

They see both nav links and can navigate to either dashboard. The coordinator view is the system-wide view; the institution view is their institution's slice. This is a feature, not a bug — a coordinator who is also a keeper at Citizen Conservation should be able to see "what their hat says" from each role.

A coordinator-with-institution edit on `/dashboard/institution/` is auditable just like any keeper edit. The `actor_institution_id` snapshot + `actor_user` make role disambiguation possible after the fact.

### 7.3 Page composition

`/dashboard/institution/page.tsx` server-renders a list view of `ExSituPopulation` records filtered to the user's institution, plus an "Edit" affordance per row. Edit form lives at `/dashboard/institution/populations/[id]/edit/page.tsx` — a server-rendered page with a client-island form. Submit is a server action (matches the L4 server-action localization pattern; see `frontend/app/[locale]/signup/actions.ts`).

Empty-state copy: "No populations attached to your institution yet — contact your coordinator at `<contact_email>`." (Visible at Tier 3+ via the institution detail serializer, which already returns `contact_email` for Tier 3+; for Tier 2 we render a generic "contact a coordinator" link to the platform contact email.)

### 7.4 Middleware gating

Add `/dashboard/institution` to `frontend/middleware.ts` alongside `/dashboard/coordinator`. Gate condition:
- Tier 2+ AND token present (`authGate`).
- Institution-membership check happens server-side on the page itself: read `/me/` via SSR, redirect to `/account` if `claim_status != "approved"`. Middleware doesn't have access to the institution-membership block (it would require an extra round trip per request); page-level enforcement is fine here because the API enforces the same check anyway.

---

## 8. "Last edited by" attribution mechanic (D9)

### 8.1 Decision: denormalized columns

Add to `ExSituPopulation`:

```python
last_edited_at = models.DateTimeField(null=True, blank=True, db_index=True)
last_edited_by_user = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.SET_NULL,
    null=True, blank=True,
    related_name="+",
)
last_edited_by_institution = models.ForeignKey(
    Institution,
    on_delete=models.SET_NULL,
    null=True, blank=True,
    related_name="+",
)
updated_at = models.DateTimeField(auto_now=True)  # general freshness signal
```

### 8.2 Reasoning vs option (a) "read from AuditEntry at render time"

- **Render performance.** The coordinator dashboard's stale-census panel already paginates ~all populations; adding a "latest audit row per population" subquery per render is a join + window function. Doable, but a real cost. Denormalized columns are an O(1) read per row.
- **Decoupling.** The audit log is append-only and may eventually be archived to cold storage or partitioned out of the hot path. "Last edited by" is a UX concern, not a forensic one — keeping it on the row keeps the UX read independent of the audit-log retention policy.
- **Consistency.** Both writes happen in the same `perform_update` transaction. The denormalized columns are guaranteed consistent with the audit row that recorded the same edit.
- **Pattern.** This is the right pattern for any future auditable model (`Transfer`, `BreedingRecommendation`). Establish it now.

The cost: three new columns, one more `UPDATE` per edit. A keeper editing four populations a month adds 48 row-updates per year. Trivial.

### 8.3 Coordinator dashboard surface

The S5 acceptance criterion says each row in the coordinator dashboard population list shows last-edit attribution. Today the coordinator dashboard's stale-census panel lists populations with species + institution + dates. Add a small `last_edited_by` column on the panel showing:

- "Last edited: `<institution_name>` staff, `<UpdatedAgo last_edited_at />`"  if `last_edited_by_institution` is the same as `population.institution`
- "Last edited: coordinator (`<user.email>`), `<UpdatedAgo />`" if `last_edited_by_institution` is NULL or different (tier 3+ override)
- "Never edited" if `last_edited_at` is NULL

The display logic is in `frontend/lib/coordinatorDashboard.ts` types + a small render helper. The Django side just exposes the three new columns on `ExSituPopulationListSerializer` (via a new `last_edited_by` brief block) — gated to tier 3+ to avoid leaking who edits what at other institutions to a Tier 2 user (they only see their own institution's rows anyway, but defense-in-depth).

---

## 9. Cache discipline (D7 cont., CLAUDE.md auth/i18n rules)

### 9.1 Restated rules (CLAUDE.md, no new policy)

Any tier-aware fetch needs `revalidate: 0` (or `force-dynamic`). The new `/dashboard/institution` adds another tier-aware path. Apply the same discipline:

- `frontend/app/[locale]/dashboard/institution/page.tsx` — `export const dynamic = "force-dynamic"`. The page is per-user (institution-membership-scoped), so ISR makes no sense.
- `frontend/lib/institutionDashboard.ts` (new) — fetcher passes `revalidate: 0` whenever a token is present.
- The edit form's server action uses `revalidatePath("/dashboard/institution")` after a successful write so the user lands back on a fresh list.

### 9.2 Locale × auth × institution hazard

The next-intl middleware patches `Vary: Accept-Language`, so per-locale variants don't collide. Auth and institution membership both ride per-request — neither hits Next's shared ISR cache when `revalidate: 0` is set. No new hazard introduced; the existing rule covers it.

### 9.3 Coordinator dashboard regression risk

Adding the `last_edited_by` panel column to the coordinator dashboard means the existing fetcher must surface the new fields. The coordinator dashboard already runs `force-dynamic` (it's tier-aware), so no cache-key change. Just a payload growth — minor.

---

## 10. i18n — emails (D10)

### 10.1 New email templates

Two new template-pairs in `backend/accounts/templates/accounts/`:

- `institution_claim_approved_subject.txt` + `_body.txt` + `_body.html`
- `institution_claim_rejected_subject.txt` + `_body.txt` + `_body.html`

Both use the existing branded `i18n/templates/email/base.html` layout (`{% extends "email/base.html" %}`).

Strings wrapped in `{% trans %}` / `{% blocktranslate %}` per the L4 i18n rules. New strings landed in `backend/locale/en/LC_MESSAGES/django.po` (English source-of-truth) and `backend/locale/fr/LC_MESSAGES/django.po` (French — translated in the same gate; placeholder if the gate ships before the L5 French sweep, but the workshop demo is English so this is non-blocking).

### 10.2 Locale resolution

`send_translated_email()` already handles this correctly:
1. Explicit `locale` arg if passed (we don't pass; we want recipient-preferred).
2. `recipient.locale` — set at signup from `request.LANGUAGE_CODE` (existing L4 S7).
3. Fallback to `settings.LANGUAGE_CODE`.

Approval / rejection emails go to the *user* who submitted the claim; their `User.locale` is the right call. No coordinator-side localization concern because coordinators only read the admin / dashboard surfaces, not approval emails.

### 10.3 What's NOT new

- `send_translated_email()` itself — exists.
- Branded email base layout — exists.
- `User.locale` field — exists.
- `gettext_lazy as _` discipline on Django strings — exists.

---

## 11. Migration strategy (D11)

### 11.1 Sequencing

Three migrations, sequenced:

1. **`accounts/migrations/00XX_pendinginstitutionclaim.py`** — adds `PendingInstitutionClaim` model. Includes a data migration that, for any existing `User` with `institution_id IS NOT NULL`, creates a synthetic `PendingInstitutionClaim(status=APPROVED, requested_at=user.date_joined, reviewed_at=user.date_joined, reviewed_by=NULL)`. Production has no real users (per `auth-c-d.md` §10), so this is mostly belt-and-suspenders for staging seed data and dev fixtures.
2. **`audit/migrations/00XX_auditentry_actor_institution.py`** — adds `actor_institution` FK on `AuditEntry`. No backfill (existing rows are governance scope, not institution-scoped).
3. **`populations/migrations/00XX_exsitupopulation_last_edited.py`** — adds `last_edited_at`, `last_edited_by_user`, `last_edited_by_institution`, `updated_at` columns. Backfill: `updated_at = created_at` for existing rows; the three "last edited" columns stay NULL ("never edited" UX surface).

Permission class, viewset write methods, audit hook, and `/me/` extension are pure code changes — no migration. They land in the same PR as migration 2 (audit) so the audit-write call has the column available.

### 11.2 Rollout order

- Deploy backend (migrations + viewset write surface + admin) first.
- Deploy frontend (institution dashboard, account-page claim status block) second.
- The frontend can't write before the backend has the perm class and viewset; the backend can't be useful without the frontend, but it also can't break anything by being deployed alone (the new endpoints just sit unused).

---

## 12. Workshop-readiness scope cuts (D12)

### 12.1 Minimum-viable cut for the four-step demo

The BA's four-step demo:
1. Tier 2 keeper logs in.
2. Edits a count or breeding status on `/dashboard/institution`.
3. Coordinator dashboard shows "last edited by" attribution.
4. Audit log shows the edit in Django admin.

Nothing in the four steps requires:

- **Aggregate context panel** on the institution dashboard ("your institution's contribution to Species X's known captive population"). Defer. BA open question 2 — recommend yes lightweight, but it's pure additional UX.
- **In-app rejection-with-reason flow** — Coordinator-side rejection works in admin; the email is sent. The frontend rejection-state surface (re-claim affordance, rejection reason display) is a nice touch but can ship as a fast-follow.
- **Withdraw-claim self-service** — User-initiated withdrawal of a pending claim. Coordinator can reject in admin. Defer.
- **API endpoint for approval/rejection** — admin alone covers the demo. Defer the REST endpoint and the corresponding coordinator-dashboard tab.
- **`User.institution` audit signal** (§4.6). Defer; rely on `PendingInstitutionClaim` history for now.

### 12.2 Hard requirements

The MVP must include:

- `PendingInstitutionClaim` model + admin (approve/reject).
- `InstitutionScopedPermission` class.
- `ExSituPopulationViewSet` write surface (PATCH at minimum; PUT optional).
- Audit hook on `perform_update` writing one row per edit with `actor_institution`.
- Last-edited columns on `ExSituPopulation`.
- `/me/` `institution_membership` block.
- `/dashboard/institution/` list view + edit form.
- Coordinator dashboard "last edited by" indicator on the existing stale-census panel.
- Approval and rejection emails (English; French translation if L5 lands before the workshop, otherwise English-only is fine for the demo).
- The 11 + 3 (cases 12–14) permission tests.
- Smoke e2e: signup → admin-approve → edit → coordinator-dashboard-sees-attribution.

### 12.3 If 30 days is tight

The cut order, most-cuttable first:

1. Defer the L10/L5 French translation of the new email templates (English-only ships).
2. Defer the `last_edited_by` panel column on the *coordinator* dashboard. The audit log alone covers the demo's step 4. (S5 is a stated story, so this is a real cut — would need PM/BA acknowledgment.)
3. Defer the `/dashboard/institution/` aggregate context block.
4. Don't defer: write surface, permission class, audit hook, claim model, approval flow.

If the cut hits item 2, surface explicitly to Aleksei before shipping.

---

## 13. Risks and open questions

### 13.1 Open

- **R-arch-1.** Approval-action audit. Per §4.6, the moment `User.institution` flips on approval, we don't write a `User`-level audit row (User isn't audited). The `PendingInstitutionClaim` history is our trail. Aleksei to confirm that's acceptable for forensic reconstruction; if not, we add `User` to the audit signal scope which is a slightly larger lift.
- **R-arch-2.** Concurrent edits (BA open question 5). Last-write-wins with audit trail. No optimistic-locking column. This is fine for MVP but should be noted in the institution-dashboard UI ("your edit replaced an earlier change at HH:MM" if `last_edited_at` is newer than the time the user opened the form). Optional MVP polish.
- **R-arch-3.** Tier downgrade path (BA open question 6). If a coordinator clears `User.institution` on a misbehaving keeper, past audit entries stay (confirmed by `actor_institution` snapshot). The user loses prospective edit access via the perm class's `institution_id is None` short-circuit. Document in OPERATIONS.md.
- **R-arch-4.** `studbook_managed` (BA R6). Architecture has no opinion on whether keepers should be able to flip this; in scope per BA, monitor for misuse. If this becomes a problem, the perm class is the wrong layer to fix it (perm is institution-scope, not field-scope). Add a serializer-level field-readonly switch keyed on tier.
- **R-arch-5.** `BreedingEvent` interpretation (BA R7). Architecture confirms the BA's reading: edits to `breeding_status` (enum on `ExSituPopulation`) are in scope; the `BreedingEvent` model is out of scope. This is the safe interpretation.
- **R-arch-6.** Cache-poisoning regression. The new SSR fetches on `/dashboard/institution` MUST pass `revalidate: 0` whenever a token is present (CLAUDE.md auth rule). Tested via the existing pattern in `coordinatorDashboard.ts`.
- **R-arch-7.** Approval-email failure. `send_translated_email(..., fail_silently=True)` matches the existing signup pattern. A failed approval email leaves the user approved but unaware. Accept for MVP — they'll discover on next login when the institution dashboard loads. Consider a dashboard banner "your institution membership was approved on `<date>`" if the user has never logged in since approval.

### 13.2 Decision points needing human input

None blocking. The architectural decisions above (D1–D12) are within the locked decisions from the BA Q&A pass. R-arch-1 (User-level audit on approval) is the one place where Aleksei may want to push back on the §11 deferral — it's a minor migration if he wants it in scope.

### 13.3 Contradictions found between BA and sketch

One worth surfacing, resolved in this doc:

- **S4 acceptance** says the audit row is singular ("writes an `AuditEntry`"), **S6 acceptance** says "one `AuditEntry` per field changed (or one row with multi-field JSON; decision goes to the architecture pass)." The architecture chooses the multi-field-JSON single row (D2). This is consistent with S4's singular phrasing. PM should align acceptance criteria across S4 and S6 in the spec.

---

## 14. File touch summary

### Backend

- `backend/accounts/models.py` — add `PendingInstitutionClaim`.
- `backend/accounts/migrations/00XX_pendinginstitutionclaim.py` — model + data backfill.
- `backend/accounts/permissions.py` — add `InstitutionScopedPermission` factory.
- `backend/accounts/serializers.py` — extend `UserProfileSerializer` with `institution_membership` block; add `RegisterSerializer` change to create `PendingInstitutionClaim` instead of setting `User.institution`.
- `backend/accounts/views.py` — `approve_institution_claim` and `reject_institution_claim` endpoints (or admin-only for tightest cut; see §11.1).
- `backend/accounts/urls.py` — wire approval/rejection URLs.
- `backend/accounts/admin.py` — `PendingInstitutionClaimAdmin` with custom actions.
- `backend/accounts/templates/accounts/institution_claim_approved_*.{txt,html}` — three templates.
- `backend/accounts/templates/accounts/institution_claim_rejected_*.{txt,html}` — three templates.
- `backend/audit/models.py` — add `actor_institution` FK.
- `backend/audit/admin.py` — add `actor_institution` to filters / display.
- `backend/audit/migrations/00XX_actor_institution.py` — column add.
- `backend/populations/models.py` — add `last_edited_at`, `last_edited_by_user`, `last_edited_by_institution`, `updated_at`.
- `backend/populations/migrations/00XX_last_edited.py` — columns + backfill.
- `backend/populations/views.py` — convert `ExSituPopulationViewSet` to `ModelViewSet` (or keep `ReadOnlyModelViewSet` + add a focused `UpdateAPIView` if the PM wants the surface narrower); attach `InstitutionScopedPermission()`; add `perform_update` audit hook.
- `backend/populations/serializers.py` — add `ExSituPopulationWriteSerializer` (subset of fields per AUDITED_FIELDS); extend list serializer with `last_edited_by` brief block, gated to tier 3+.
- `backend/locale/{en,fr,de,es}/LC_MESSAGES/django.po` — new `{% trans %}` strings.

### Frontend

- `frontend/app/[locale]/dashboard/institution/page.tsx` — list view (force-dynamic).
- `frontend/app/[locale]/dashboard/institution/populations/[id]/edit/page.tsx` — edit page.
- `frontend/app/[locale]/dashboard/institution/populations/[id]/edit/actions.ts` — server action for save (with localization per L4 S2 pattern).
- `frontend/app/[locale]/account/page.tsx` — surface `institution_membership` block (claim status).
- `frontend/lib/institutionDashboard.ts` — fetcher (mirrors `coordinatorDashboard.ts`).
- `frontend/lib/api.ts` — no change (existing `authToken` arg covers).
- `frontend/middleware.ts` — add `/dashboard/institution` to gated paths.
- `frontend/components/NavLinks.tsx` — surface "Institution dashboard" link when session indicates approved membership.
- `frontend/messages/{en,fr,de,es}.json` — institution-dashboard, account-page-claim-status, edit-form copy.

### Operations

- `OPERATIONS.md` — note coordinator approval workflow (admin URL, expected SLA), §13.1 R-arch-3 documented.

---

## Appendix A — Test matrix delta (additions to sketch §test cases)

| # | Actor | State | Action | Expected |
|---|-------|-------|--------|----------|
| 12 | Tier 2, institution=NULL, has PENDING claim on A | population at A | PATCH | 403 |
| 13 | Tier 2, freshly-approved (last 5min), JWT not yet refreshed | population at own institution | PATCH | 200 (perm class reads DB, not JWT) |
| 14 | Tier 2, institution=NULL (revoked) | population formerly at user's institution | PATCH | 403 |

Plus the sketch's 1–11. Test-writer agent should also cover:

- Audit row is written exactly once per multi-field PATCH.
- Audit row's `actor_institution_id` matches user's institution at write time, not at read time.
- `last_edited_at` / `last_edited_by_*` columns updated atomically with the population row.
- Approval flow updates `User.institution` and writes a `PendingInstitutionClaim` row transition; failed email send doesn't leave the DB inconsistent.
- `/me/` returns the right `claim_status` for each of the five terminal states (`none`, `pending`, `approved`, `rejected`, `withdrawn`).
- Coordinator (Tier 3+) PATCH on a population at an institution they don't belong to writes audit with `actor_institution = NULL` (or coordinator's institution if they have one — the snapshot reflects user state at edit time, not the population's institution).
