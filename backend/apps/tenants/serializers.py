from rest_framework import serializers
from .models import Organisation


class OrganisationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organisation
        fields = ["id", "name", "slug", "plan", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]
