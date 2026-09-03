from rest_framework import serializers

from .models import OnboardingTask


class OnboardingTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = OnboardingTask
        fields = [
            "id", "organization_id", "employee_id", "title", "assigned_to_user_id", "due_date",
            "status", "created_at", "updated_at",
        ]
