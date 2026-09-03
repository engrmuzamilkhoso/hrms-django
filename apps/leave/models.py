"""
Mirrors Leave\\{LeaveTypeController,LeaveRequestController,LeavePolicyController,
HolidayController} models. LeaveApproval/LeaveApprovalTier had no Eloquent
model in Laravel (raw DB::table('leave_approvals') only, 12+ call sites in
LeaveRequestController) - promoted to real models here per the plan, since
this is the multi-tier approval chain at the heart of the module.
"""

from django.db import models

from apps.core.models import TenantScopedModel
from apps.organization.models import Office, Organization


class LeavePolicy(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    name = models.CharField(max_length=120)
    description = models.CharField(max_length=255, null=True, blank=True)
    is_default = models.BooleanField(default=False)
    pro_rata = models.BooleanField(default=False)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    previous_policy = models.ForeignKey(
        "self", on_delete=models.SET_NULL, db_column="previous_policy_id", null=True, blank=True, related_name="next_policy_set"
    )
    status = models.CharField(max_length=20, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "leave_policies"
        managed = True

    def __str__(self):
        return self.name


class LeaveType(TenantScopedModel):
    CATEGORY_CHOICES = [
        ("annual", "Annual"), ("casual", "Casual"), ("sick", "Sick"),
        ("maternal", "Maternal"), ("paternal", "Paternal"), ("self_managed", "Self Managed"),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    policy = models.ForeignKey(
        LeavePolicy, on_delete=models.SET_NULL, db_column="leave_policy_id", null=True, blank=True, related_name="leave_types"
    )
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, null=True, blank=True)
    affects_balance = models.BooleanField(default=True)
    annual_quota = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    carry_forward_enabled = models.BooleanField(default=False)
    carry_forward_max = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    carry_reset_date = models.DateField(null=True, blank=True)
    encashable = models.BooleanField(default=False)
    negative_balance_allowed = models.BooleanField(default=False)
    auto_approve_threshold_days = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "leave_types"
        managed = True

    def __str__(self):
        return self.name


class LeaveRequest(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey("people.Employee", on_delete=models.CASCADE, db_column="employee_id")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE, db_column="leave_type_id")
    from_date = models.DateField()
    to_date = models.DateField()
    duration_type = models.CharField(max_length=20, default="full_day")
    requested_days = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=30, default="pending")
    current_approval_level = models.PositiveIntegerField(default=1)
    reason = models.TextField(null=True, blank=True)
    applied_by_user_id = models.BigIntegerField(null=True, blank=True)
    approved_by_user_id = models.BigIntegerField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    delegated_to_user_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "leave_requests"
        managed = True


class LeaveApproval(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    leave_request = models.ForeignKey(
        LeaveRequest, on_delete=models.CASCADE, db_column="leave_request_id", related_name="approvals"
    )
    approver_employee = models.ForeignKey(
        "people.Employee", on_delete=models.CASCADE, db_column="approver_employee_id"
    )
    level_no = models.PositiveIntegerField()
    status = models.CharField(max_length=30, default="pending")
    acted_by_user_id = models.BigIntegerField(null=True, blank=True)
    acted_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "leave_approvals"
        managed = True


class LeaveApprovalTier(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    leave_type = models.ForeignKey(
        LeaveType, on_delete=models.SET_NULL, db_column="leave_type_id", null=True, blank=True
    )
    level_no = models.PositiveIntegerField()
    role_name = models.CharField(max_length=120)
    can_delegate = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "leave_approval_tiers"
        managed = True


class Holiday(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    office = models.ForeignKey(Office, on_delete=models.SET_NULL, db_column="office_id", null=True, blank=True)
    name = models.CharField(max_length=180)
    holiday_date = models.DateField()
    holiday_type = models.CharField(max_length=40, default="public")
    is_recurring = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "holidays"
        managed = True


class LeaveCarryForward(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey("people.Employee", on_delete=models.CASCADE, db_column="employee_id")
    from_policy = models.ForeignKey(
        LeavePolicy, on_delete=models.CASCADE, db_column="from_policy_id", related_name="carry_forwards_from"
    )
    to_policy = models.ForeignKey(
        LeavePolicy, on_delete=models.CASCADE, db_column="to_policy_id", related_name="carry_forwards_to"
    )
    leave_type_category = models.CharField(max_length=30)
    remaining_days = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    carried_forward_days = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    processed_at = models.DateTimeField(null=True, blank=True)
    processed_by_user_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "leave_carry_forwards"
        managed = True
        unique_together = (("employee", "from_policy", "to_policy", "leave_type_category"),)
