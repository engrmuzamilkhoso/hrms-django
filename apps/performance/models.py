"""
Mirrors Performance\\{PerformanceCycleController,GoalController,
PromotionController} models. `performance_cycles` has NO migration at all
in the source app (PerformanceCycleController would 500 with "table doesn't
exist" the moment it's hit) - created here for real since the model/
controller clearly specify its intended shape (see plan's "fix only dead
code"). `goals.status` is a real MySQL ENUM('draft','active','completed',
'cancelled') that does NOT include 'open', which GoalController::store()
hardcodes - also dead-on-arrival; ported using the schema's real default
('draft') instead of replicating the crash.
"""

from django.db import models

from apps.core.models import TenantScopedModel
from apps.organization.models import Organization


class PerformanceCycle(TenantScopedModel):
    CYCLE_TYPE_CHOICES = [
        ("annual", "Annual"), ("semi_annual", "Semi-Annual"), ("quarterly", "Quarterly"), ("custom", "Custom"),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    name = models.CharField(max_length=140)
    cycle_type = models.CharField(max_length=20, choices=CYCLE_TYPE_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=30, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "performance_cycles"
        managed = True

    def __str__(self):
        return self.name


class Goal(models.Model):
    TYPE_CHOICES = [("individual", "Individual"), ("team", "Team"), ("organizational", "Organizational")]
    STATUS_CHOICES = [("draft", "Draft"), ("active", "Active"), ("completed", "Completed"), ("cancelled", "Cancelled")]

    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    performance_cycle_id = models.BigIntegerField(null=True, blank=True)
    organization_objective_id = models.BigIntegerField(null=True, blank=True)
    employee_id = models.BigIntegerField(null=True, blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="individual")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    target_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    achieved_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    weightage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "goals"
        managed = True

    def __str__(self):
        return self.title


class PromotionRequest(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey("people.Employee", on_delete=models.CASCADE, db_column="employee_id")
    new_designation = models.CharField(max_length=120)
    salary_structure_id = models.BigIntegerField(null=True, blank=True)
    effective_date = models.DateField()
    justification = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=30, default="pending")
    current_level = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "promotion_requests"
        managed = True


class PromotionApproval(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    promotion_request = models.ForeignKey(
        PromotionRequest, on_delete=models.CASCADE, db_column="promotion_request_id"
    )
    level_no = models.PositiveIntegerField()
    role_name = models.CharField(max_length=80)
    status = models.CharField(max_length=30, default="pending")
    acted_by_user_id = models.BigIntegerField(null=True, blank=True)
    note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "promotion_approvals"
        managed = True
