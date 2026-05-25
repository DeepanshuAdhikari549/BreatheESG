from rest_framework import serializers
from .models import UploadBatch


class UploadBatchSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    uploaded_by_email = serializers.EmailField(
        source="uploaded_by.email", read_only=True, default=None
    )
    source_type_display = serializers.CharField(
        source="get_source_type_display", read_only=True
    )

    class Meta:
        model = UploadBatch
        fields = [
            "id", "source_type", "source_type_display", "file_name", "status",
            "total_rows", "processed_rows", "failed_rows",
            "uploaded_by_name", "uploaded_by_email", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return None


class UploadBatchDetailSerializer(UploadBatchSerializer):
    class Meta(UploadBatchSerializer.Meta):
        fields = UploadBatchSerializer.Meta.fields + ["error_message"]
