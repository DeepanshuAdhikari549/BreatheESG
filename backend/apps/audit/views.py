from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated
from apps.auth_ext.permissions import IsAnalystOrAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsAnalystOrAdmin]
    
    def get_queryset(self):
        org = getattr(self.request, 'organisation', None)
        if not org:
            return AuditLog.objects.none()
        
        queryset = AuditLog.objects.filter(organisation=org)
        
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
            
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
            
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(actor_email__icontains=search)
            
        return queryset
