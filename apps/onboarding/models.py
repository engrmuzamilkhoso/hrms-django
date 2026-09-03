from django.db import models

from apps.core.models import TenantScopedModel
from apps.organization.models import Organization


class OnboardingTask(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey("people.Employee", on_delete=models.CASCADE, db_column="employee_id")
    title = models.CharField(max_length=180)
    assigned_to_user_id = models.BigIntegerField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "onboarding_tasks"
        managed = True
