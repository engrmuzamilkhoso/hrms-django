"""Mirrors Attendance\\{AttendanceController,AttendanceRuleController,ShiftController,ShiftSwapController} models."""

from django.db import models

from apps.core.models import TenantScopedModel
from apps.organization.models import Department, Office, Organization


class Shift(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    office = models.ForeignKey(Office, on_delete=models.SET_NULL, db_column="office_id", null=True, blank=True)
    name = models.CharField(max_length=120)
    start_time = models.TimeField()
    end_time = models.TimeField()
    grace_minutes = models.PositiveIntegerField(default=0)
    min_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    overtime_after_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    overtime_multiplier = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    night_diff_multiplier = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shifts"
        managed = True

    def __str__(self):
        return self.name


class AttendanceRule(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    office = models.ForeignKey(Office, on_delete=models.CASCADE, db_column="office_id")
    grace_minutes = models.PositiveIntegerField(default=0)
    min_hours_for_full_day = models.DecimalField(max_digits=5, decimal_places=2, default=8)
    missing_punch_alert = models.BooleanField(default=True)
    late_deduction_after_n_days = models.PositiveIntegerField(default=3)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_rules"
        managed = True


class WfhPolicy(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey(
        "people.Employee", on_delete=models.SET_NULL, db_column="employee_id", null=True, blank=True
    )
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, db_column="department_id", null=True, blank=True
    )
    monthly_cap = models.PositiveIntegerField(default=8)
    hr_override_allowed = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wfh_policies"
        managed = True


class AttendanceRecord(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey("people.Employee", on_delete=models.CASCADE, db_column="employee_id")
    office = models.ForeignKey(Office, on_delete=models.SET_NULL, db_column="office_id", null=True, blank=True)
    attendance_date = models.DateField()
    clock_in = models.DateTimeField(null=True, blank=True)
    clock_out = models.DateTimeField(null=True, blank=True)
    work_minutes = models.PositiveIntegerField(null=True, blank=True)
    method = models.CharField(max_length=40)
    is_wfh = models.BooleanField(default=False)
    is_late = models.BooleanField(default=False)
    is_half_day = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_records"
        managed = True
        unique_together = (("employee", "attendance_date"),)


class ShiftSwapRequest(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    from_employee = models.ForeignKey(
        "people.Employee", on_delete=models.CASCADE, db_column="from_employee_id", related_name="+"
    )
    to_employee = models.ForeignKey(
        "people.Employee", on_delete=models.CASCADE, db_column="to_employee_id", related_name="+"
    )
    swap_date = models.DateField()
    status = models.CharField(max_length=30, default="pending_hr")
    approved_by_user_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shift_swap_requests"
        managed = True
