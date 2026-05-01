import hmac
from typing import Protocol

from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


class _HasInstitution(Protocol):
    """Protocol matching any model with an `institution_id` attribute.

    Used by `InstitutionScopedPermission.has_object_permission` so the
    permission class stays generic across populations / fieldwork / future
    institution-scoped models without forcing a base mixin refactor.
    """

    institution_id: int | None


def TierPermission(min_tier: int = 1) -> type[BasePermission]:  # noqa: N802
    """Factory that returns a DRF permission class requiring a minimum access tier.

    Usage:
        permission_classes = [TierPermission(3)]  # Tier 3+ required
    """

    class _TierPermission(BasePermission):
        def has_permission(self, request: Request, view: APIView) -> bool:
            if not request.user or not request.user.is_authenticated:
                # Anonymous users are treated as Tier 1
                return min_tier <= 1
            # Deactivated accounts are not authenticated *for our purposes*
            # even if Django says is_authenticated=True. Without this check,
            # a session created before deactivation (or a force_authenticate
            # in tests) keeps tier access alive after the operator account
            # was disabled. Found by adversarial test of Panel 7.
            if not request.user.is_active:
                return False
            return request.user.access_tier >= min_tier

        def has_object_permission(self, request: Request, view: APIView, obj: object) -> bool:
            return self.has_permission(request, view)

    _TierPermission.__name__ = f"TierPermission_{min_tier}"
    _TierPermission.__qualname__ = f"TierPermission_{min_tier}"
    return _TierPermission


def TierOrServiceTokenPermission(  # noqa: N802
    min_tier: int, token_setting: str
) -> type[BasePermission]:
    """Accept either a Tier N+ authenticated session OR a matching service token.

    Server-to-server callers (e.g. Next.js rendering the coordinator
    dashboard) send ``Authorization: Bearer <token>``. The token is
    compared against ``settings.<token_setting>`` with a constant-time
    compare. If the setting is blank or the header is missing/invalid,
    fall back to the tier check. Anonymous users without a valid token
    and without a Tier N+ session are rejected.
    """

    class _TierOrTokenPermission(BasePermission):
        def has_permission(self, request: Request, view: APIView) -> bool:
            expected = getattr(settings, token_setting, "") or ""
            if expected:
                auth = request.headers.get("Authorization", "")
                if auth.startswith("Bearer "):
                    provided = auth[len("Bearer ") :]
                    if hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8")):
                        return True
            if not request.user or not request.user.is_authenticated:
                return False
            # See the matching note on _TierPermission: is_authenticated is
            # True for any concrete user record, including deactivated ones.
            # We need to gate explicitly on is_active or a deactivated
            # operator with a live session continues to bypass the tier
            # check. The service-token branch above is checked first and
            # is unaffected.
            if not request.user.is_active:
                return False
            return request.user.access_tier >= min_tier

        def has_object_permission(self, request: Request, view: APIView, obj: object) -> bool:
            return self.has_permission(request, view)

    _TierOrTokenPermission.__name__ = f"TierOrServiceToken_{min_tier}_{token_setting}"
    _TierOrTokenPermission.__qualname__ = _TierOrTokenPermission.__name__
    return _TierOrTokenPermission


def InstitutionScopedPermission(  # noqa: N802
    *,
    min_tier: int = 2,
    coordinator_tier: int = 3,
) -> type[BasePermission]:
    """Tier ``min_tier``+ user can act on objects whose ``institution_id``
    matches their own. Tier ``coordinator_tier``+ is unconstrained
    (full read/write across all institutions). Anonymous, deactivated, or
    sub-``min_tier`` users are rejected.

    Usage on a viewset::

        class ExSituPopulationViewSet(viewsets.ModelViewSet):
            permission_classes = [InstitutionScopedPermission()]

    The viewset MUST also override ``get_queryset()`` to filter list views
    by institution for sub-coordinator-tier users — ``has_object_permission``
    only fires on detail / write operations and is not a substitute for
    queryset scoping.
    """

    class _InstitutionScopedPermission(BasePermission):
        def has_permission(self, request: Request, view: APIView) -> bool:
            user = request.user
            if not user or not user.is_authenticated:
                return False
            if not user.is_active:
                return False
            tier = getattr(user, "access_tier", 0)
            if tier < min_tier:
                return False
            # Coordinator tier and above are unconstrained.
            if tier >= coordinator_tier:
                return True
            # Sub-coordinator: must have an approved institution association.
            return getattr(user, "institution_id", None) is not None

        def has_object_permission(
            self,
            request: Request,
            view: APIView,
            obj: _HasInstitution,
        ) -> bool:
            user = request.user
            if not user or not user.is_authenticated or not user.is_active:
                return False
            tier = getattr(user, "access_tier", 0)
            if tier >= coordinator_tier:
                return True
            if tier < min_tier:
                return False
            user_institution_id = getattr(user, "institution_id", None)
            if user_institution_id is None:
                return False
            obj_institution_id = getattr(obj, "institution_id", None)
            return bool(obj_institution_id == user_institution_id)

    _InstitutionScopedPermission.__name__ = (
        f"InstitutionScopedPermission_{min_tier}_{coordinator_tier}"
    )
    _InstitutionScopedPermission.__qualname__ = _InstitutionScopedPermission.__name__
    return _InstitutionScopedPermission
