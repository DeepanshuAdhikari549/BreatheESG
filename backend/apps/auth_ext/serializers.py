from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User
from apps.tenants.models import Organisation


class UserSerializer(serializers.ModelSerializer):
    organisation_name = serializers.CharField(
        source="organisation.name", read_only=True, default=None
    )
    organisation_slug = serializers.CharField(
        source="organisation.slug", read_only=True, default=None
    )

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "organisation_name", "organisation_slug", "is_active",
        ]
        read_only_fields = ["id"]


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            username=attrs["username"], password=attrs["password"]
        )
        if not user:
            raise serializers.ValidationError("Invalid credentials.")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled.")
        attrs["user"] = user
        return attrs


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    organisation_slug = serializers.SlugField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ["username", "email", "password", "first_name", "last_name",
                  "role", "organisation_slug"]

    def create(self, validated_data):
        org_slug = validated_data.pop("organisation_slug", None)
        password = validated_data.pop("password")
        organisation = None
        if org_slug:
            try:
                organisation = Organisation.objects.get(slug=org_slug, is_active=True)
            except Organisation.DoesNotExist:
                raise serializers.ValidationError(
                    {"organisation_slug": "Organisation not found."}
                )
        user = User(**validated_data)
        user.set_password(password)
        user.organisation = organisation
        user.save()
        return user
