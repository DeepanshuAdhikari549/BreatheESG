from rest_framework import serializers
from .models import EmissionRecord
from apps.review.serializers import ReviewActionSerializer

class EmissionRecordListSerializer(serializers.ModelSerializer):
    batch_id = serializers.UUIDField(source='batch.id', read_only=True)
    source_type = serializers.CharField(source='batch.source_type', read_only=True)
    
    class Meta:
        model = EmissionRecord
        fields = [
            'id',
            'activity_description',
            'scope',
            'normalised_qty_kg_co2e',
            'raw_unit',
            'period_start',
            'period_end',
            'review_status',
            'is_suspicious',
            'is_locked',
            'batch_id',
            'source_type',
            'created_at'
        ]
        read_only_fields = fields

class EmissionRecordDetailSerializer(serializers.ModelSerializer):
    batch_id = serializers.UUIDField(source='batch.id', read_only=True)
    source_type = serializers.CharField(source='batch.source_type', read_only=True)
    reviewed_by_email = serializers.EmailField(source='reviewed_by.email', read_only=True)
    review_actions = ReviewActionSerializer(many=True, read_only=True)
    
    class Meta:
        model = EmissionRecord
        fields = [
            'id',
            'batch_id',
            'source_type',
            'organisation',
            'activity_description',
            'quantity',
            'raw_unit',
            'fuel_type',
            'travel_class',
            'plant_code',
            'source_ref',
            'category',
            'period_start',
            'period_end',
            'normalised_qty_kg_co2e',
            'canonical_unit',
            'emission_factor',
            'scope',
            'is_suspicious',
            'suspicious_reasons',
            'review_status',
            'reviewed_by',
            'reviewed_by_email',
            'reviewed_at',
            'is_locked',
            'review_actions',
            'created_at',
            'updated_at'
        ]
        read_only_fields = fields
