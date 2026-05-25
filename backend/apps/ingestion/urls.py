from rest_framework.routers import DefaultRouter
from .views import UploadBatchViewSet

router = DefaultRouter()
router.register(r"uploads", UploadBatchViewSet, basename="upload")
urlpatterns = router.urls
