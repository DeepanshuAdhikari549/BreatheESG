import uuid
from django.db import models


class EmissionRecord(models.Model):
    class Scope(models.TextChoices):
        SCOPE1 = "1", "Scope 1 — Direct"
        SCOPE2 = "2", "Scope 2 — Indirect (Energy)"
        SCOPE3 = "3", "Scope 3 — Value Chain"

    class ReviewStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        FLAGGED = "FLAGGED", "Flagged"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(
        "ingestion.UploadBatch", on_delete=models.CASCADE, related_name="records"
    )
    organisation = models.ForeignKey(
        "tenants.Organisation", on_delete=models.CASCADE, related_name="emission_records"
    )

    # Activity
    activity_description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=18, decimal_places=4)
    raw_unit = models.CharField(max_length=50)
    fuel_type = models.CharField(max_length=100, blank=True)
    travel_class = models.CharField(max_length=20, blank=True)
    plant_code = models.CharField(max_length=50, blank=True)
    source_ref = models.CharField(max_length=255, blank=True)
    category = models.CharField(max_length=100, blank=True)

    # Period
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)

    # Normalised
    normalised_qty_kg_co2e = models.DecimalField(
        max_digits=18, decimal_places=4, null=True, blank=True
    )
    canonical_unit = models.CharField(max_length=50, default="kg_CO2e")
    emission_factor = models.DecimalField(
        max_digits=10, decimal_places=6, null=True, blank=True
    )

    # Classification
    scope = models.CharField(max_length=1, choices=Scope.choices, null=True, blank=True)

    # Suspicious flags
    is_suspicious = models.BooleanField(default=False)
    suspicious_reasons = models.JSONField(default=list)

    # Review workflow
    review_status = models.CharField(
        max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.PENDING
    )
    reviewed_by = models.ForeignKey(
        "auth_ext.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_records",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # Audit lock — once APPROVED the record is immutable
    is_locked = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.pk:
            original = EmissionRecord.objects.get(pk=self.pk)
            if original.is_locked:
                from django.core.exceptions import ValidationError
                raise ValidationError("This record is locked and cannot be modified.")
        super().save(*args, **kwargs)

    class Meta:
        db_table = "emission_records"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organisation", "review_status"]),
            models.Index(fields=["organisation", "scope"]),
            models.Index(fields=["batch"]),
            models.Index(fields=["organisation", "is_suspicious"]),
        ]

    def __str__(self):
        return (
            f"{self.activity_description} | "
            f"{self.normalised_qty_kg_co2e} kg CO2e | Scope {self.scope}"
        )
