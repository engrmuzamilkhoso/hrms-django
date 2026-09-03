"""
Payroll app models - built out incrementally; EmployeeCompensation is needed
early since People\\{EmployeeController,DesignationController} write to it
directly. Full payroll module (runs, tax, reimbursements) lands in its own
migration phase.
"""

from django.db import models

from apps.core.models import TenantScopedModel
from apps.organization.models import Organization


class SalaryStructure(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    name = models.CharField(max_length=140)
    is_default = models.BooleanField(default=False)
    effective_from = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "salary_structures"
        managed = True

    def __str__(self):
        return self.name


class SalaryComponent(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    salary_structure = models.ForeignKey(
        SalaryStructure, on_delete=models.CASCADE, db_column="salary_structure_id", related_name="components"
    )
    component_name = models.CharField(max_length=120)
    component_type = models.CharField(max_length=30)
    tax_treatment = models.CharField(max_length=30, default="taxable")
    calc_method = models.CharField(max_length=30, default="fixed")
    formula = models.TextField(null=True, blank=True)
    default_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "salary_components"
        managed = True


class EmployeeCompensation(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey(
        "people.Employee", on_delete=models.CASCADE, db_column="employee_id", related_name="compensations"
    )
    salary_structure = models.ForeignKey(
        SalaryStructure,
        on_delete=models.SET_NULL,
        db_column="salary_structure_id",
        null=True,
        blank=True,
    )
    designation = models.ForeignKey(
        "people.Designation",
        on_delete=models.DO_NOTHING,
        db_column="designation_id",
        db_constraint=False,
        null=True,
        blank=True,
    )
    gross_monthly = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="PKR")
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_compensations"
        managed = True


class PayrollRun(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    period_start = models.DateField()
    period_end = models.DateField()
    payroll_scope = models.CharField(max_length=40, default="organization")
    office_id = models.BigIntegerField(null=True, blank=True)
    department_id = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=30, default="draft")
    total_gross = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    total_net = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    locked_by_user_id = models.BigIntegerField(null=True, blank=True)
    approved_by_user_id = models.BigIntegerField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payroll_runs"
        managed = True


class PayrollItem(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    payroll_run = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, db_column="payroll_run_id", related_name="items")
    employee = models.ForeignKey("people.Employee", on_delete=models.CASCADE, db_column="employee_id")
    component_name = models.CharField(max_length=120)
    component_type = models.CharField(max_length=30)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    note = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payroll_items"
        managed = True


class TaxRule(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    country_code = models.CharField(max_length=2)
    rule_name = models.CharField(max_length=140)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    metadata_json = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tax_rules"
        managed = True


class TaxBracket(models.Model):
    tax_rule = models.ForeignKey(TaxRule, on_delete=models.CASCADE, db_column="tax_rule_id", related_name="brackets")
    range_min = models.DecimalField(max_digits=16, decimal_places=2)
    range_max = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    percentage_rate = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    fixed_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tax_brackets"
        managed = True


class EmployeeLoan(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey("people.Employee", on_delete=models.CASCADE, db_column="employee_id")
    principal_amount = models.DecimalField(max_digits=14, decimal_places=2)
    remaining_balance = models.DecimalField(max_digits=14, decimal_places=2)
    monthly_deduction = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=30, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_loans"
        managed = True


class ExpenseReimbursement(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey("people.Employee", on_delete=models.CASCADE, db_column="employee_id")
    description = models.CharField(max_length=255)
    category = models.CharField(max_length=80, default="other")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="PKR")
    expense_date = models.DateField()
    receipt_url = models.CharField(max_length=500, null=True, blank=True)
    status = models.CharField(max_length=30, default="pending")
    approved_by_user_id = models.BigIntegerField(null=True, blank=True)
    payroll_run_id = models.BigIntegerField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "expense_reimbursements"
        managed = True
