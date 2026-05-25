import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import UploadBatch
from .serializers import UploadBatchSerializer, UploadBatchDetailSerializer
from . import services

logger = logging.getLogger(__name__)


class UploadBatchViewSet(viewsets.ReadOnlyModelViewSet):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["source_type", "status"]

    def get_queryset(self):
        org = self.request.organisation
        if org is None:
            return UploadBatch.objects.none()
        return UploadBatch.objects.filter(organisation=org).select_related("uploaded_by")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return UploadBatchDetailSerializer
        return UploadBatchSerializer

    def create(self, request, *args, **kwargs):
        org = request.organisation
        if org is None:
            return Response(
                {"detail": "No organisation associated with your account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        source_type = request.data.get("source_type", "").upper()
        if source_type not in [c[0] for c in UploadBatch.SourceType.choices]:
            return Response(
                {"detail": f"Invalid source_type. Choose from: SAP, UTILITY, TRAVEL"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"detail": "No file provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch = UploadBatch.objects.create(
            organisation=org,
            source_type=source_type,
            file_name=uploaded_file.name,
            file=uploaded_file,
            uploaded_by=request.user,
        )

        try:
            services.process_batch(str(batch.id))
            batch.refresh_from_db()
        except Exception as exc:
            logger.error("Ingestion failed for batch %s: %s", batch.id, exc)

        serializer = UploadBatchDetailSerializer(batch)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="records")
    def records(self, request, pk=None):
        from apps.emissions.models import EmissionRecord
        from apps.emissions.serializers import EmissionRecordListSerializer

        batch = self.get_object()
        qs = EmissionRecord.objects.filter(batch=batch).order_by("-created_at")

        # Optional filters
        scope = request.query_params.get("scope")
        if scope:
            qs = qs.filter(scope=scope)
        is_suspicious = request.query_params.get("is_suspicious")
        if is_suspicious is not None:
            qs = qs.filter(is_suspicious=is_suspicious.lower() == "true")

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = EmissionRecordListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = EmissionRecordListSerializer(qs, many=True)
        return Response(serializer.data)
