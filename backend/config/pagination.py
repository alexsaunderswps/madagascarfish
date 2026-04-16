from __future__ import annotations

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from species.models import Species


class SpeciesListPagination(PageNumberPagination):
    """Species list pagination with described/undescribed counts in the response envelope."""

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200

    def get_paginated_response(self, data: list) -> Response:
        described = Species.objects.filter(
            taxonomic_status=Species.TaxonomicStatus.DESCRIBED
        ).count()
        total = Species.objects.count()
        return Response(
            {
                "count": self.page.paginator.count,
                "described_count": described,
                "undescribed_count": total - described,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "results": data,
            }
        )
