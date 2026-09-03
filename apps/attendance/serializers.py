from rest_framework import serializers

from .models import AttendanceRecord, AttendanceRule, Shift, ShiftSwapRequest


class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = [
            "id", "organization_id", "office_id", "name", "start_time", "end_time",
            "grace_minutes", "min_hours", "overtime_after_hours", "overtime_multiplier",
            "night_diff_multiplier", "created_at", "updated_at",
        ]


class AttendanceRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceRule
        fields = [
            "id", "organization_id", "office_id", "grace_minutes", "min_hours_for_full_day",
            "missing_punch_alert", "late_deduction_after_n_days", "created_at", "updated_at",
        ]


class AttendanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceRecord
        fields = [
            "id", "organization_id", "employee_id", "office_id", "attendance_date",
            "clock_in", "clock_out", "work_minutes", "method", "is_wfh", "is_late",
            "is_half_day", "created_at", "updated_at",
        ]


class ShiftSwapRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShiftSwapRequest
        fields = [
            "id", "organization_id", "from_employee_id", "to_employee_id", "swap_date",
            "status", "approved_by_user_id", "created_at", "updated_at",
        ]
