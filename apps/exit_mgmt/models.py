"""
Mirrors Exit\\ExitWorkflowController.php models. NOTE: the source app's
ExitWorkflow.php model file is a fatal PHP parse error (two concatenated
`<?php ... class ExitWorkflow ...` blocks with no closing tag between them -
literally cannot be parsed/autoloaded), and the live `exit_workflows` table
has no organization_id column at all despite the model using the
BelongsToOrganization trait (which would 500 on `Unknown column` for every
query even if the parse error were fixed). The Exit module is therefore
completely inaccessible in the source app today - modeled here against the
*real* table schema (exit_date not last_working_date; no reason/notice_days
columns to persist) rather than replicated as permanently broken. Tenant
scoping is derived via the related Employee (which does have organization_id)
since the table itself has no such column - see plan's "fix only dead code".
"""

from django.db import models


class ExitWorkflow(models.Model):
    employee = models.ForeignKey(
        "people.Employee", on_delete=models.SET_NULL, db_column="employee_id", null=True, blank=True
    )
    exit_type = models.CharField(max_length=255, null=True, blank=True)
    exit_date = models.DateField(null=True, blank=True)
    short_notice_recovery = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    outstanding_salary = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    leave_encashment = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    gratuity_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    loan_recovery = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    final_settlement_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    clearance_override = models.BooleanField(default=False)
    clearance_override_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exit_workflows"
        managed = True


class ExitSettlement(models.Model):
    organization = models.ForeignKey(
        "organization.Organization", on_delete=models.CASCADE, db_column="organization_id"
    )
    exit_workflow = models.ForeignKey(ExitWorkflow, on_delete=models.CASCADE, db_column="exit_workflow_id")
    employee = models.ForeignKey("people.Employee", on_delete=models.CASCADE, db_column="employee_id")
    outstanding_salary = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    leave_encashment = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    gratuity_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    loan_recovery = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    net_settlement = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=30, default="draft")
    override_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exit_settlements"
        managed = True
        unique_together = (("organization", "exit_workflow", "employee"),)


class ExitClearanceTask(models.Model):
    organization = models.ForeignKey(
        "organization.Organization", on_delete=models.CASCADE, db_column="organization_id"
    )
    exit_workflow_id = models.BigIntegerField(null=True, blank=True)
    employee = models.ForeignKey("people.Employee", on_delete=models.CASCADE, db_column="employee_id")
    department_name = models.CharField(max_length=80)
    status = models.CharField(max_length=30, default="pending")
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exit_clearance_tasks"
        managed = True


class OrgClearanceDepartment(models.Model):
    organization = models.ForeignKey(
        "organization.Organization", on_delete=models.CASCADE, db_column="organization_id"
    )
    department_name = models.CharField(max_length=80)
    responsible_user_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "org_clearance_departments"
        managed = True
        unique_together = (("organization", "department_name"),)
