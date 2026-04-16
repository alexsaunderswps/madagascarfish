from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


def TierPermission(min_tier: int = 1) -> type[BasePermission]:
    """Factory that returns a DRF permission class requiring a minimum access tier.

    Usage:
        permission_classes = [TierPermission(3)]  # Tier 3+ required
    """

    class _TierPermission(BasePermission):
        def has_permission(self, request: Request, view: APIView) -> bool:
            if not request.user or not request.user.is_authenticated:
                # Anonymous users are treated as Tier 1
                return min_tier <= 1
            return request.user.access_tier >= min_tier  # type: ignore[union-attr]

        def has_object_permission(self, request: Request, view: APIView, obj: object) -> bool:
            return self.has_permission(request, view)

    _TierPermission.__name__ = f"TierPermission_{min_tier}"
    _TierPermission.__qualname__ = f"TierPermission_{min_tier}"
    return _TierPermission
