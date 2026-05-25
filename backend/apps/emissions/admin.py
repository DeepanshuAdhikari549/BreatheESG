from django.contrib import admin
from .models import EmissionRecord

@admin.register(EmissionRecord)
class EmissionRecordAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'organisation',
        'activity_description',
        'quantity',
        'raw_unit',
        'normalised_qty_kg_co2e',
        'scope',
        'review_status',
        'is_suspicious',
        'is_locked'
    )
    list_filter = ('organisation', 'scope', 'review_status', 'is_suspicious', 'is_locked')
    search_fields = ('activity_description', 'source_ref')
