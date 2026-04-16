from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from config.views import health_check
from fieldwork.views import FieldProgramViewSet
from populations.views import ExSituPopulationViewSet, InstitutionViewSet
from species.views import SpeciesViewSet
from species.views_dashboard import DashboardView
from species.views_map import MapSummaryView, SpeciesLocalityGeoView, WatershedListView

router = DefaultRouter()
router.register(r"species", SpeciesViewSet, basename="species")
router.register(r"institutions", InstitutionViewSet, basename="institution")
router.register(r"populations", ExSituPopulationViewSet, basename="population")
router.register(r"field-programs", FieldProgramViewSet, basename="field-program")

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("auth/", include("accounts.urls")),
    # Core CRUD endpoints
    path("", include(router.urls)),
    # Dashboard
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    # Map endpoints
    path("map/localities/", SpeciesLocalityGeoView.as_view(), name="map-localities"),
    path("map/watersheds/", WatershedListView.as_view(), name="map-watersheds"),
    path("map/summary/", MapSummaryView.as_view(), name="map-summary"),
    # OpenAPI schema
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="schema-swagger-ui"),
]
