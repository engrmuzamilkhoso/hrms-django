"""
Mirrors Laravel's Organization\\{OrganizationController,OfficeController,
DepartmentController,TeamController} models. Organization itself is the
tenant root (no organization_id column - it *is* the tenant), so it does not
use TenantScopedModel.
"""

from django.db import models

from apps.core.models import TenantScopedModel


class Organization(models.Model):
    name = models.CharField(max_length=180)
    logo_url = models.CharField(max_length=500, null=True, blank=True)
    slug = models.CharField(max_length=190, unique=True)
    country_code = models.CharField(max_length=2)
    industry = models.CharField(max_length=120, null=True, blank=True)
    default_currency = models.CharField(max_length=3)
    timezone = models.CharField(max_length=64)
    fiscal_year_start = models.DateField(null=True, blank=True)
    working_week = models.CharField(max_length=20, default="Mon-Fri")
    default_language = models.CharField(max_length=20, default="en")
    date_format = models.CharField(max_length=20, default="YYYY-MM-DD")
    plan_code = models.CharField(max_length=50, default="beta_free")
    status = models.CharField(max_length=30, default="active")
    trial_user_limit = models.PositiveIntegerField(null=True, blank=True)
    custom_monthly_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    ai_credit_balance = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organizations"
        managed = True

    def __str__(self):
        return self.name


class OrganizationSetting(TenantScopedModel):
    organization = models.OneToOneField(
        Organization, on_delete=models.CASCADE, db_column="organization_id", related_name="settings"
    )
    hr_mode = models.CharField(max_length=30, default="global")
    exit_clearance_mode = models.CharField(max_length=30, default="strict")
    free_tier_employee_limit = models.PositiveIntegerField(default=20)
    low_ai_credit_threshold = models.PositiveIntegerField(default=50)
    seed_data_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organization_settings"
        managed = True


class OrganizationObjective(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    title = models.CharField(max_length=180)
    description = models.TextField(null=True, blank=True)
    weightage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organization_objectives"
        managed = True

    def __str__(self):
        return self.title


class Office(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    name = models.CharField(max_length=150)
    country_code = models.CharField(max_length=2)
    city = models.CharField(max_length=120)
    address = models.CharField(max_length=255, null=True, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    attendance_radius_m = models.PositiveIntegerField(null=True, blank=True)
    timezone = models.CharField(max_length=64, null=True, blank=True)
    is_default = models.BooleanField(default=False)
    wfh_monthly_cap = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "offices"
        managed = True

    def __str__(self):
        return self.name


class Department(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    office = models.ForeignKey(Office, on_delete=models.CASCADE, db_column="office_id", null=True, blank=True)
    name = models.CharField(max_length=140)
    code = models.CharField(max_length=50, null=True, blank=True)
    description = models.CharField(max_length=500, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    budget = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    parent_department_id = models.BigIntegerField(null=True, blank=True)
    head_employee_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "departments"
        managed = True

    def __str__(self):
        return self.name


class Team(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    department = models.ForeignKey(Department, on_delete=models.CASCADE, db_column="department_id")
    name = models.CharField(max_length=140)
    lead_employee_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "teams"
        managed = True

    def __str__(self):
        return self.name
