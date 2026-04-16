from __future__ import annotations


class TierAwareSerializerMixin:
    """Mixin providing tier detection from the request context."""

    def _get_tier(self) -> int:
        request = self.context.get("request")  # type: ignore[attr-defined]
        if request and hasattr(request, "user") and request.user.is_authenticated:
            return getattr(request.user, "access_tier", 1)
        return 1
