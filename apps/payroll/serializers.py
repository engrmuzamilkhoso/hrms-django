from rest_framework import serializers

from .models import (
    EmployeeCompensation,
    ExpenseReimbursement,
    PayrollItem,
    PayrollRun,
    SalaryComponent,
    SalaryStructure,
    TaxBracket,
    TaxRule,
)


class SalaryStructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalaryStructure
        fields = ["id", "organization_id", "name", "is_default", "effective_from", "created_at", "updated_at"]


class SalaryComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalaryComponent
        fields = [
            "id", "organization_id", "salary_structure_id", "component_name", "component_type",
            "tax_treatment", "calc_method", "formula", "default_amount", "created_at", "updated_at",
        ]


class EmployeeCompensationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeCompensation
        fields = [
            "id", "organization_id", "employee_id", "salary_structure_id", "designation_id",
            "gross_monthly", "currency", "effective_from", "effective_to", "created_at", "updated_at",
        ]


class PayrollRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollRun
        fields = [
            "id", "organization_id", "period_start", "period_end", "payroll_scope", "office_id",
            "department_id", "status", "total_gross", "total_deductions", "total_net",
            "locked_by_user_id", "approved_by_user_id", "approved_at", "created_at", "updated_at",
        ]


class PayrollItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollItem
        fields = [
            "id", "organization_id", "payroll_run_id", "employee_id", "component_name",
            "component_type", "amount", "note", "created_at", "updated_at",
        ]


class TaxBracketSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxBracket
        fields = ["id", "tax_rule_id", "range_min", "range_max", "percentage_rate", "fixed_amount", "created_at", "updated_at"]


class TaxRuleSerializer(serializers.ModelSerializer):
    brackets = TaxBracketSerializer(many=True, read_only=True)

    class Meta:
        model = TaxRule
        fields = [
            "id", "organization_id", "country_code", "rule_name", "effective_from", "effective_to",
            "metadata_json", "created_at", "updated_at", "brackets",
        ]


class ExpenseReimbursementSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)

    class Meta:
        model = ExpenseReimbursement
        fields = [
            "id", "organization_id", "employee_id", "description", "category", "amount", "currency",
            "expense_date", "receipt_url", "status", "approved_by_user_id", "payroll_run_id",
            "rejection_reason", "created_at", "updated_at", "employee_name", "employee_code",
        ]
