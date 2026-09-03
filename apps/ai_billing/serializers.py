from rest_framework import serializers

from .models import AiCreditTransaction


class AiCreditTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiCreditTransaction
        fields = [
            "id", "organization_id", "operation_type", "credits_delta", "balance_after",
            "reference_type", "reference_id", "created_at",
        ]
