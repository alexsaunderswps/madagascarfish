from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "Madagascar Freshwater Fish Conservation Platform"
admin.site.site_title = "MFFCP Admin"
admin.site.index_title = "MFFCP Administration"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("config.api_urls")),
]
