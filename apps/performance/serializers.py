from rest_framework import serializers

from .models import Goal, PerformanceCycle


class PerformanceCycleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerformanceCycle
        fields = ["id", "organization_id", "name", "cycle_type", "start_date", "end_date", "status", "created_at", "updated_at"]


class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = [
            "id", "title", "description", "performance_cycle_id", "organization_objective_id", "employee_id",
            "type", "status", "target_value", "achieved_value", "weightage", "start_date", "end_date",
            "created_at", "updated_at",
        ]
