from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            'id',
            'organisation',
            'actor',
            'actor_email',
            'entity_type',
            'entity_id',
            'action',
            'diff',
            'ip_address',
            'user_agent',
            'created_at'
        ]
        read_only_fields = fields
