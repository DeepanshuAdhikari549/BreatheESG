from django.contrib import admin
from .models import UploadBatch


@admin.register(UploadBatch)
class UploadBatchAdmin(admin.ModelAdmin):
    list_display = [
        "file_name", "source_type", "status", "organisation",
        "total_rows", "processed_rows", "failed_rows", "created_at",
    ]
    list_filter = ["source_type", "status", "organisation"]
    search_fields = ["file_name", "organisation__name"]
    readonly_fields = ["id", "created_at", "updated_at", "error_message"]
