import uuid
from django.db import models
from apps.tenants.models import Organisation
from apps.auth_ext.models import User


class UploadBatch(models.Model):
    class SourceType(models.TextChoices):
        SAP = "SAP", "SAP Fuel & Procurement"
        UTILITY = "UTILITY", "Utility Electricity"
        TRAVEL = "TRAVEL", "Corporate Travel"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey(
        Organisation, on_delete=models.CASCADE, related_name="batches"
    )
    source_type = models.CharField(max_length=20, choices=SourceType.choices)
    file_name = models.CharField(max_length=255)
    file = models.FileField(upload_to="uploads/%Y/%m/")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    error_message = models.TextField(blank=True)
    total_rows = models.IntegerField(default=0)
    processed_rows = models.IntegerField(default=0)
    failed_rows = models.IntegerField(default=0)
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="uploads"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "upload_batches"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.source_type} — {self.file_name} ({self.status})"
