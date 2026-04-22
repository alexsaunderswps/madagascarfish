import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


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
                    if hmac.compare_digest(provided, expected):
                        return True
            if not request.user or not request.user.is_authenticated:
                return False
            return request.user.access_tier >= min_tier

        def has_object_permission(self, request: Request, view: APIView, obj: object) -> bool:
            return self.has_permission(request, view)

    _TierOrTokenPermission.__name__ = f"TierOrServiceToken_{min_tier}_{token_setting}"
    _TierOrTokenPermission.__qualname__ = _TierOrTokenPermission.__name__
    return _TierOrTokenPermission
