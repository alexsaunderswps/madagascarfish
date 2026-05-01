# Permission class sketch — `InstitutionScopedPermission`

> **Status:** Sketch only. Not implemented. For discussion before
> architecture pass on `docs/planning/business-analysis/institution-scoped-editing.md`.

## Goal

A DRF permission class that says:

> A request can read or write this object if the user is Tier 2+,
> active, has a non-null `institution`, AND the object's `institution`
> matches the user's. Tier 3+ users are not constrained by the
> institution match (coordinators see and edit everything).

## Where it lives

`backend/accounts/permissions.py`, alongside `TierPermission` and
`TierOrServiceTokenPermission`.

## Sketch

```python
# backend/accounts/permissions.py (additions)

from typing import Protocol

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


class _HasInstitution(Protocol):
    """Anything with an `institution_id` attribute (FK target).

    Avoids importing concrete model classes at permission-class definition
    time; keeps the perm class generic across populations / fieldwork /
    future institution-scoped models.
    """
    institution_id: int | None


def InstitutionScopedPermission(  # noqa: N802
    *,
    min_tier: int = 2,
    coordinator_tier: int = 3,
) -> type[BasePermission]:
    """Tier 2+ user can act on objects whose `institution` matches theirs.

    Tier `coordinator_tier`+ is unconstrained (see all institutions).
    Anonymous users are rejected.

    Usage on a viewset:

        class ExSituPopulationViewSet(viewsets.ModelViewSet):
            permission_classes = [InstitutionScopedPermission()]
            ...

    The viewset must also override `get_queryset()` to filter list views
    by institution — `has_object_permission` only fires on detail/write
    operations and is not a substitute for queryset scoping.
    """

    class _InstitutionScopedPermission(BasePermission):
        def has_permission(self, request: Request, view: APIView) -> bool:
            user = request.user
            if not user or not user.is_authenticated:
                return False
            if not user.is_active:
                return False
            if user.access_tier < min_tier:
                return False
            # Tier 3+ does not need an institution association.
            if user.access_tier >= coordinator_tier:
                return True
            # Tier 2 with no institution: read-only public surfaces only,
            # not this viewset.
            return user.institution_id is not None

        def has_object_permission(
            self,
            request: Request,
            view: APIView,
            obj: _HasInstitution,
        ) -> bool:
            user = request.user
            # Re-check has_permission preconditions (DRF does this for us
            # in normal flow but we keep the guard explicit for tests
            # that bypass the view-level check).
            if not user or not user.is_authenticated or not user.is_active:
                return False
            if user.access_tier >= coordinator_tier:
                return True
            if user.access_tier < min_tier:
                return False
            if user.institution_id is None:
                return False
            return getattr(obj, "institution_id", None) == user.institution_id

    _InstitutionScopedPermission.__name__ = (
        f"InstitutionScopedPermission_{min_tier}_{coordinator_tier}"
    )
    _InstitutionScopedPermission.__qualname__ = (
        _InstitutionScopedPermission.__name__
    )
    return _InstitutionScopedPermission
```

## Usage on `ExSituPopulationViewSet`

```python
# backend/populations/views.py (sketch)

from accounts.permissions import InstitutionScopedPermission
from rest_framework import viewsets


class ExSituPopulationViewSet(viewsets.ModelViewSet):
    """Tier 2+ institution staff edit their own institution's populations.

    Tier 3+ coordinators see and edit all institutions.

    Replaces the previous ReadOnlyModelViewSet — write methods now exist
    but are gated on InstitutionScopedPermission.
    """

    permission_classes = [InstitutionScopedPermission()]
    serializer_class = ExSituPopulationDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = ExSituPopulation.objects.select_related(
            "species", "institution"
        )
        # Coordinators see everything.
        if user.is_authenticated and user.access_tier >= 3:
            return qs
        # Tier 2 with institution sees their institution's populations.
        if user.is_authenticated and user.institution_id is not None:
            return qs.filter(institution_id=user.institution_id)
        return qs.none()

    def perform_update(self, serializer):
        # Audit hook lands here. See "audit integration" below.
        instance = serializer.save()
        # ... audit-write call ...
        return instance
```

## Why a Protocol and not a base model

The existing codebase doesn't have a single base `InstitutionOwned`
mixin. Models that have `institution` FKs include `ExSituPopulation`,
`Transfer` (two FKs!), `BreedingRecommendation`, and `FieldProgram`.
Forcing a base class now would be a wide refactor. The Protocol-based
duck-typed approach keeps the permission class narrow and lets each
viewset declare what "the institution FK" means for that model. For
`Transfer` (out of scope this gate), a future variant of the perm class
can check both `source_institution_id` and `destination_institution_id`.

## Subtle correctness notes

1. **`has_permission` vs `has_object_permission`.** DRF calls
   `has_permission` on every request, and `has_object_permission` only
   on detail / object-level mutations. The viewset's `get_queryset()`
   filtering is what makes list views safe — `has_object_permission`
   doesn't fire on list. **The permission class alone is not
   sufficient; queryset scoping is mandatory.**

2. **`is_active` re-check.** Mirrors the
   `_TierPermission` pattern (see comment in
   `backend/accounts/permissions.py:23–27`). A deactivated account with
   a live session must lose access immediately.

3. **`institution_id` not `institution`.** Comparing the FK id avoids
   triggering a Django related-object load on every permission check.
   Cheaper and safer than `obj.institution == user.institution` (which
   loads both rows).

4. **`obj` may be a non-model object** (DRF can pass arbitrary objects
   in custom views). The `getattr(..., "institution_id", None)` guard
   makes a misuse return False rather than raising.

5. **Coordinator override.** Tier 3+ skips the institution check
   entirely. This keeps the coordinator dashboard's behavior unchanged
   and ensures coordinators can edit *any* institution's data when
   triaging issues.

## What this perm class does NOT do

- It does not write audit entries. Audit is a separate concern, hooked
  in `perform_update` / `perform_create` on the viewset.
- It does not enforce field-level scope (e.g., "Tier 2 can edit
  `count_total` but not `studbook_managed`"). If we need that later,
  it goes on the serializer, not the perm class.
- It does not check whether the institution claim is approved — that's
  the model invariant: `User.institution` is NULL until approved, and
  `institution_id is None` short-circuits the check.

## Test cases the test-writer should cover

Spec these from the BA, not from the perm class implementation.

| # | Actor | Object | Action | Expected |
|---|-------|--------|--------|----------|
| 1 | Tier 2, institution=A | population at A | GET | 200 |
| 2 | Tier 2, institution=A | population at A | PATCH | 200 |
| 3 | Tier 2, institution=A | population at B | GET | 404 (queryset scoping) |
| 4 | Tier 2, institution=A | population at B | PATCH | 404 (queryset scoping) |
| 5 | Tier 2, institution=NULL | any | GET list | 200, empty list |
| 6 | Tier 2, institution=NULL | any | PATCH | 403 |
| 7 | Tier 3, institution=A | population at B | PATCH | 200 (coordinator override) |
| 8 | Tier 3, institution=NULL | population at A | PATCH | 200 |
| 9 | Anonymous | any | GET | 401 |
| 10 | Tier 2, deactivated | population at own institution | PATCH | 403 (is_active check) |
| 11 | Tier 1 (registered, not researcher) | any | PATCH | 403 (below min_tier) |

Cases 3 and 4 are 404 not 403 because the queryset filter hides the
record from the user entirely — DRF returns 404 on `.get()` against an
empty queryset. This is the desired "leak nothing" behavior.

## Audit integration (separate concern, sketched here for completeness)

```python
# backend/populations/views.py (audit sketch)

from audit.models import AuditEntry
from django.forms.models import model_to_dict


class ExSituPopulationViewSet(viewsets.ModelViewSet):
    AUDITED_FIELDS = (
        "count_total",
        "count_male",
        "count_female",
        "count_unsexed",
        "breeding_status",
        "last_census_date",
        "notes",
        "studbook_managed",
    )

    def perform_update(self, serializer):
        before = model_to_dict(
            serializer.instance, fields=self.AUDITED_FIELDS
        )
        instance = serializer.save()
        after = model_to_dict(instance, fields=self.AUDITED_FIELDS)
        changed = {
            k: {"before": before[k], "after": after[k]}
            for k in self.AUDITED_FIELDS
            if before[k] != after[k]
        }
        if changed:
            AuditEntry.objects.create(
                target_type="populations.ExSituPopulation",
                target_id=instance.pk,
                actor_type=AuditEntry.ActorType.USER,
                actor_user=self.request.user,
                action=AuditEntry.Action.UPDATE,
                before={k: v["before"] for k, v in changed.items()},
                after={k: v["after"] for k, v in changed.items()},
                reason=self.request.data.get("_reason", ""),
            )
        return instance
```

This is the *minimum* viable audit hook. The architecture pass should
decide:

- One `AuditEntry` row per write, multi-field JSON (sketched above), vs.
  one row per field changed.
- Whether `_reason` is required for institution edits (probably yes —
  a single-field reason: "monthly census" / "found new juveniles").
- Whether to capture the user's `institution_id` at edit time onto the
  audit row (defends against later re-assignment of `User.institution`
  obscuring history).

## Open implementation questions

1. **Where does the institution-claim approval workflow live?** Django
   admin custom action vs. a small `accounts/views.py` endpoint. Admin
   is simplest for the pre-workshop cut.
2. **Pending-claim model.** Add a `PendingInstitutionClaim` model, or
   add `User.pending_institution` FK + `User.institution_approved_at`
   timestamp? The latter is one-table, simpler, and matches the "user
   is authoritative" model.
3. **Do we expose any of this through the existing `/me/` endpoint** so
   the frontend can render "your institution: X (approved)" or "pending
   approval"? Yes — the account page needs to show membership state.
4. **Caching.** The coordinator dashboard's queryset scoping is
   already `revalidate: 0` for tier-aware fetches (per CLAUDE.md auth
   notes). The institution dashboard inherits the same discipline; no
   new cache hazard.
