import uuid
from django.db import models


class ReviewAction(models.Model):
    class Action(models.TextChoices):
        APPROVE = "APPROVE", "Approved"
        REJECT = "REJECT", "Rejected"
        FLAG = "FLAG", "Flagged"
        COMMENT = "COMMENT", "Comment Added"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record = models.ForeignKey(
        "emissions.EmissionRecord",
        on_delete=models.CASCADE,
        related_name="review_actions",
    )
    actor = models.ForeignKey(
        "auth_ext.User", on_delete=models.CASCADE, related_name="review_actions"
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "review_actions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.actor.email} → {self.action} on {self.record_id}"
