from django.urls import include, path

from config.views import health_check

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("auth/", include("accounts.urls")),
]
