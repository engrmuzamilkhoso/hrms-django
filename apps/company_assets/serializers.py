from rest_framework import serializers

from .models import Asset


class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = [
            "id", "organization_id", "asset_code", "category", "name", "serial_number", "purchase_date",
            "cost", "condition_status", "assigned_to_employee_id", "created_at", "updated_at",
        ]
