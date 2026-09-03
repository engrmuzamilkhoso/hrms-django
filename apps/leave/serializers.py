from rest_framework import serializers

from .models import Holiday, LeavePolicy, LeaveRequest, LeaveType


class LeaveTypeSerializer(serializers.ModelSerializer):
    leave_policy_id = serializers.IntegerField(source="policy_id", read_only=True)

    class Meta:
        model = LeaveType
        fields = [
            "id", "organization_id", "leave_policy_id", "name", "category", "affects_balance",
            "annual_quota", "carry_forward_enabled", "carry_forward_max", "carry_reset_date",
            "encashable", "negative_balance_allowed", "auto_approve_threshold_days",
            "created_at", "updated_at",
        ]


class LeaveTypeRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ["id", "name", "category", "affects_balance"]


class EmployeeRefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    employee_code = serializers.CharField()


class LeaveRequestSerializer(serializers.ModelSerializer):
    leave_type = LeaveTypeRefSerializer(read_only=True)
    employee = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "organization_id", "employee_id", "leave_type_id", "from_date", "to_date",
            "duration_type", "requested_days", "status", "current_approval_level", "reason",
            "applied_by_user_id", "approved_by_user_id", "approved_at", "rejection_reason",
            "delegated_to_user_id", "created_at", "updated_at", "leave_type", "employee",
        ]

    def get_employee(self, obj):
        if not obj.employee_id:
            return None
        return {"id": obj.employee.id, "full_name": obj.employee.full_name, "employee_code": obj.employee.employee_code}


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = [
            "id", "organization_id", "office_id", "name", "holiday_date", "holiday_type",
            "is_recurring", "created_at", "updated_at",
        ]


class LeavePolicySerializer(serializers.ModelSerializer):
    leave_types = LeaveTypeSerializer(many=True, read_only=True)
    employees_count = serializers.SerializerMethodField()
    computed_status = serializers.SerializerMethodField()

    class Meta:
        model = LeavePolicy
        fields = [
            "id", "organization_id", "name", "description", "is_default", "pro_rata",
            "start_date", "end_date", "previous_policy_id", "status", "created_at", "updated_at",
            "leave_types", "employees_count", "computed_status",
        ]

    def get_employees_count(self, obj):
        from apps.people.models import Employee

        return Employee.all_objects.filter(leave_policy_id=obj.id).count()

    def get_computed_status(self, obj):
        if not obj.start_date or not obj.end_date:
            return "active"
        from django.utils import timezone

        today = timezone.localdate()
        if today > obj.end_date:
            return "expired"
        if (obj.end_date - today).days <= 30:
            return "expiring_soon"
        return "active"
