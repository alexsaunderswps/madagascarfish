from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import models

if TYPE_CHECKING:
    from accounts.models import User


def scope_to_institution(
    queryset: models.QuerySet,  # type: ignore[type-arg]
    user: User,
    institution_field: str = "institution",
) -> models.QuerySet:  # type: ignore[type-arg]
    """Filter a queryset to records belonging to the user's institution.

    Tier 5 (admin) has no institution restriction.
    Tier 3-4 users can only access records for their affiliated institution.
    Users below Tier 3 or without an institution affiliation get an empty queryset.
    """
    if user.access_tier >= 5:
        return queryset
    if user.access_tier < 3:
        return queryset.none()
    if not user.institution_id:
        return queryset.none()
    return queryset.filter(**{institution_field: user.institution_id})
