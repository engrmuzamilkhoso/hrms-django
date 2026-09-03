from rest_framework import serializers

from apps.organization.models import Department, Office, Team

from .models import (
    Designation,
    Employee,
    EmployeeBankAccount,
    EmployeeDocument,
    EmployeeEducation,
    EmployeeEmergencyContact,
    EmployeeWorkExperience,
    ProbationReview,
)


class _RefSerializer(serializers.Serializer):
    """Minimal nested representation matching Eloquent's ->load(['office',...])."""

    id = serializers.IntegerField()
    name = serializers.CharField()


class EmployeeSerializer(serializers.ModelSerializer):
    """Field names/keys mirror Eloquent's raw column output
    (employees.designation -> "designation", not the Python attname
    designation_text used internally to avoid shadowing the FK accessor)."""

    office = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    team = serializers.SerializerMethodField()
    shift = serializers.SerializerMethodField()
    leave_policy = serializers.SerializerMethodField()
    reporting_manager = serializers.SerializerMethodField()
    designation = serializers.CharField(source="designation_text", read_only=True)
    designation_id = serializers.IntegerField(source="current_designation_id", read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "organization_id",
            "user_id",
            "office_id",
            "department_id",
            "team_id",
            "shift_id",
            "leave_policy_id",
            "reporting_manager_id",
            "employee_code",
            "full_name",
            "email",
            "phone",
            "dob",
            "gender",
            "marital_status",
            "nationality",
            "national_id_no",
            "passport_no",
            "designation",
            "designation_id",
            "contract_type",
            "employment_status",
            "hire_date",
            "probation_end_date",
            "confirmation_date",
            "exit_date",
            "created_at",
            "updated_at",
            "office",
            "department",
            "team",
            "shift",
            "leave_policy",
            "reporting_manager",
        ]

    def get_office(self, obj):
        return {"id": obj.office_id, "name": obj.office.name} if obj.office_id and obj.office else None

    def get_department(self, obj):
        return {"id": obj.department_id, "name": obj.department.name} if obj.department_id and obj.department else None

    def get_team(self, obj):
        return {"id": obj.team_id, "name": obj.team.name} if obj.team_id and obj.team else None

    def get_shift(self, obj):
        if not obj.shift_id:
            return None
        from apps.attendance.models import Shift

        shift = Shift.objects.filter(pk=obj.shift_id).first()
        return (
            {"id": shift.id, "name": shift.name, "start_time": shift.start_time, "end_time": shift.end_time}
            if shift
            else None
        )

    def get_leave_policy(self, obj):
        if not obj.leave_policy_id:
            return None
        from apps.leave.models import LeavePolicy

        policy = LeavePolicy.objects.filter(pk=obj.leave_policy_id).first()
        return {"id": policy.id, "name": policy.name, "description": policy.description} if policy else None

    def get_reporting_manager(self, obj):
        if not obj.reporting_manager_id or not obj.reporting_manager:
            return None
        m = obj.reporting_manager
        return {"id": m.id, "full_name": m.full_name, "employee_code": m.employee_code, "designation": m.designation_text}


class EmployeeBankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeBankAccount
        fields = [
            "id", "organization_id", "employee_id", "bank_name", "account_title", "account_number",
            "iban", "branch_code", "currency", "is_primary", "created_at", "updated_at",
        ]


class EmployeeEmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeEmergencyContact
        fields = [
            "id", "organization_id", "employee_id", "name", "relationship", "phone", "email",
            "address", "is_primary", "created_at", "updated_at",
        ]


class EmployeeEducationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeEducation
        fields = [
            "id", "organization_id", "employee_id", "degree", "institution", "field_of_study",
            "start_year", "end_year", "grade", "certificate_url", "created_at", "updated_at",
        ]


class EmployeeWorkExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeWorkExperience
        fields = [
            "id", "organization_id", "employee_id", "company_name", "job_title", "start_date",
            "end_date", "is_current", "responsibilities", "created_at", "updated_at",
        ]


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeDocument
        fields = [
            "id", "organization_id", "employee_id", "document_type", "document_number", "file_url",
            "issue_date", "expiry_date", "status", "notes", "created_at", "updated_at",
        ]


class ProbationReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProbationReview
        fields = [
            "id", "organization_id", "employee_id", "probation_end_date", "status",
            "extended_to_date", "notes", "created_at", "updated_at",
        ]


class DesignationSerializer(serializers.ModelSerializer):
    employees_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Designation
        fields = [
            "id",
            "organization_id",
            "title",
            "grade",
            "base_salary",
            "currency",
            "description",
            "is_active",
            "created_at",
            "updated_at",
            "employees_count",
        ]
