from rest_framework import serializers

from .models import Department, Office, Organization, Team


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "id", "name", "logo_url", "slug", "country_code", "industry", "default_currency",
            "timezone", "fiscal_year_start", "working_week", "default_language", "date_format",
            "plan_code", "status", "trial_user_limit", "custom_monthly_price", "ai_credit_balance",
            "created_at", "updated_at",
        ]


class OfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = [
            "id", "organization_id", "name", "country_code", "city", "address", "latitude",
            "longitude", "attendance_radius_m", "timezone", "is_default", "wfh_monthly_cap",
            "created_at", "updated_at",
        ]


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = [
            "id", "organization_id", "office_id", "name", "code", "description", "is_active",
            "budget", "parent_department_id", "head_employee_id", "created_at", "updated_at",
        ]


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = [
            "id", "organization_id", "department_id", "name", "lead_employee_id",
            "created_at", "updated_at",
        ]
