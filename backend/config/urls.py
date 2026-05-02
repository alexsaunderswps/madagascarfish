from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "Malagasy Freshwater Fishes Conservation Platform"
admin.site.site_title = "MFFCP Admin"
admin.site.index_title = "MFFCP Administration"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("config.api_urls")),
]

if settings.DEBUG:
    # django-stubs models urlpatterns as list[URLResolver] and static() returns
    # list[URLPattern]; Django itself treats both as URL entries, so cast the
    # concatenation target to keep mypy quiet without loosening the module type.
    urlpatterns = urlpatterns + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)  # type: ignore[operator]
