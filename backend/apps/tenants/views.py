from rest_framework import viewsets, permissions
from .models import Organisation
from .serializers import OrganisationSerializer
from apps.auth_ext.permissions import IsAdminUser


class OrganisationViewSet(viewsets.ModelViewSet):
    queryset = Organisation.objects.all()
    serializer_class = OrganisationSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return Organisation.objects.all()
        if user.organisation:
            return Organisation.objects.filter(id=user.organisation_id)
        return Organisation.objects.none()
