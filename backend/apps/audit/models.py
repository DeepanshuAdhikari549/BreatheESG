import uuid
from django.db import models


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey(
        "tenants.Organisation",
        on_delete=models.CASCADE,
        related_name="audit_logs",
        null=True,
    )
    actor = models.ForeignKey(
        "auth_ext.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs",
    )
    # Denormalised for immutability — actor may be deleted later
    actor_email = models.EmailField(blank=True)
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=100)
    action = models.CharField(max_length=100)
    diff = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.actor_email} | {self.action} | {self.entity_type}:{self.entity_id}"
