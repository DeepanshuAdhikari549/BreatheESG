from django.utils.functional import SimpleLazyObject
from .models import Organisation


def _get_organisation(request):
    if hasattr(request, "user") and request.user.is_authenticated:
        org = getattr(request.user, "organisation", None)
        if org is not None:
            return org
    slug = request.headers.get("X-Organisation-Slug")
    if slug:
        try:
            return Organisation.objects.get(slug=slug, is_active=True)
        except Organisation.DoesNotExist:
            pass
    return None


class TenantMiddleware:
    """Attach the current Organisation to every request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.organisation = SimpleLazyObject(lambda: _get_organisation(request))
        return self.get_response(request)
