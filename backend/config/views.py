from django.http import JsonResponse


def health(request):
    return JsonResponse({"status": "ok", "service": "breathe-esg-api"})


def root(request):
    return JsonResponse({
        "status": "ok",
        "service": "breathe-esg-api",
        "docs": "/api/health/",
    })
