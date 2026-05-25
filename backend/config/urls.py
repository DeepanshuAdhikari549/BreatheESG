"""Root URL configuration for ESG Platform."""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.auth_ext.urls")),
    path("api/", include("apps.tenants.urls")),
    path("api/", include("apps.ingestion.urls")),
    path("api/", include("apps.emissions.urls")),
    path("api/", include("apps.review.urls")),
    path("api/", include("apps.audit.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
