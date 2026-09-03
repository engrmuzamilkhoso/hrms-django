from django.db import models

from apps.core.models import TenantScopedModel
from apps.organization.models import Organization


class Asset(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    asset_code = models.CharField(max_length=80)
    category = models.CharField(max_length=100)
    name = models.CharField(max_length=160)
    serial_number = models.CharField(max_length=120, null=True, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    condition_status = models.CharField(max_length=40, default="good")
    assigned_to_employee_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "assets"
        managed = True

    def __str__(self):
        return self.name
