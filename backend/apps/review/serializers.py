from rest_framework import serializers
from .models import ReviewAction

class ReviewActionSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source='actor.email', read_only=True)
    actor_role = serializers.CharField(source='actor.role', read_only=True)
    record_id = serializers.UUIDField(source='record.id', read_only=True)
    
    class Meta:
        model = ReviewAction
        fields = [
            'id',
            'record_id',
            'actor_email',
            'actor_role',
            'action',
            'comment',
            'created_at'
        ]
        read_only_fields = fields

class ReviewActionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewAction
        fields = ['action', 'comment']
        
    def validate_action(self, value):
        if value not in [ReviewAction.Action.APPROVE, ReviewAction.Action.REJECT, ReviewAction.Action.FLAG, ReviewAction.Action.COMMENT]:
            raise serializers.ValidationError("Invalid review action.")
        return value
