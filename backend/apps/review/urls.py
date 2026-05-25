from django.urls import path
from .views import RecordReviewView, ReviewQueueView

urlpatterns = [
    path('records/<uuid:record_id>/review/', RecordReviewView.as_view(), name='record-review'),
    path('review/queue/', ReviewQueueView.as_view(), name='review-queue'),
]
