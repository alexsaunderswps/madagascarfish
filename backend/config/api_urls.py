from django.urls import path

from config.views import health_check

urlpatterns = [
    path("health/", health_check, name="health-check"),
]
