from django.utils import timezone
from django.db import models
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.auth_ext.permissions import IsAnalystOrAdmin
from apps.emissions.models import EmissionRecord
from apps.emissions.serializers import EmissionRecordDetailSerializer, EmissionRecordListSerializer
from apps.audit.utils import log_action
from .models import ReviewAction
from .serializers import ReviewActionCreateSerializer, ReviewActionSerializer

class RecordReviewView(APIView):
    permission_classes = [IsAuthenticated, IsAnalystOrAdmin]
    
    def post(self, request, record_id):
        org = getattr(request, 'organisation', None)
        if not org:
            return Response({"detail": "Organization context missing."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            record = EmissionRecord.objects.get(id=record_id, organisation=org)
        except EmissionRecord.DoesNotExist:
            return Response({"detail": "Emission record not found."}, status=status.HTTP_404_NOT_FOUND)
            
        if record.is_locked:
            return Response({"detail": "This record is locked and cannot be reviewed."}, status=status.HTTP_400_BAD_REQUEST)
            
        serializer = ReviewActionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        action = serializer.validated_data['action']
        comment = serializer.validated_data.get('comment', '')
        
        old_status = record.review_status
        old_is_suspicious = record.is_suspicious
        old_is_locked = record.is_locked
        
        if action == ReviewAction.Action.APPROVE:
            record.review_status = EmissionRecord.ReviewStatus.APPROVED
            record.is_locked = True
            record.reviewed_by = request.user
            record.reviewed_at = timezone.now()
        elif action == ReviewAction.Action.REJECT:
            record.review_status = EmissionRecord.ReviewStatus.REJECTED
        elif action == ReviewAction.Action.FLAG:
            record.review_status = EmissionRecord.ReviewStatus.FLAGGED
            record.is_suspicious = True
        
        record.save()
        
        review_action = ReviewAction.objects.create(
            record=record,
            actor=request.user,
            action=action,
            comment=comment
        )
        
        diff = {
            "review_status": {"old": old_status, "new": record.review_status},
            "is_suspicious": {"old": old_is_suspicious, "new": record.is_suspicious},
            "is_locked": {"old": old_is_locked, "new": record.is_locked},
            "action": action,
            "comment": comment
        }
        log_action(request, "EmissionRecord", record.id, f"RECORD_{action}", diff)
        
        return Response({
            "detail": f"Review action '{action}' recorded successfully.",
            "record": EmissionRecordDetailSerializer(record).data,
            "action": ReviewActionSerializer(review_action).data
        }, status=status.HTTP_201_CREATED)

class ReviewQueueView(generics.ListAPIView):
    serializer_class = EmissionRecordListSerializer
    permission_classes = [IsAuthenticated, IsAnalystOrAdmin]
    
    def get_queryset(self):
        org = getattr(self.request, 'organisation', None)
        if not org:
            return EmissionRecord.objects.none()
            
        return EmissionRecord.objects.filter(
            organisation=org
        ).filter(
            models.Q(review_status=EmissionRecord.ReviewStatus.PENDING) |
            models.Q(is_suspicious=True)
        ).distinct().order_by('-created_at')
