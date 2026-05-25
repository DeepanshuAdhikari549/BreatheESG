from django.contrib import admin
from .models import AuditLog

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'organisation', 'actor_email', 'entity_type', 'entity_id', 'action', 'created_at')
    list_filter = ('organisation', 'entity_type', 'action')
    search_fields = ('actor_email', 'entity_type', 'entity_id')
    
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
