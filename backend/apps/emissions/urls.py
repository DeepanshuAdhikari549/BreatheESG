from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmissionRecordViewSet

router = DefaultRouter()
router.register(r'records', EmissionRecordViewSet, basename='emission-record')

urlpatterns = [
    path('dashboard/', EmissionRecordViewSet.as_view({'get': 'dashboard'}), name='dashboard'),
    path('', include(router.urls)),
]
