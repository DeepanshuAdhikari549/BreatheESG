from django.contrib import admin
from .models import ReviewAction

@admin.register(ReviewAction)
class ReviewActionAdmin(admin.ModelAdmin):
    list_display = ('id', 'record', 'actor', 'action', 'created_at')
    list_filter = ('action', 'created_at')
    search_fields = ('record__id', 'actor__email', 'comment')
