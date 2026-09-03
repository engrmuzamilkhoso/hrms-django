"""
Mirrors Platform\\{OrganizationAdminController,PlanPricingController,
BillingController,SurveyController,AccountingIntegrationController} models.
BillingRecord/PlanPricing are cross-tenant (platform-level), hence plain
models.Model rather than TenantScopedModel.
"""

from django.db import models

from apps.organization.models import Organization


class PlanPricing(models.Model):
    plan_code = models.CharField(max_length=30, unique=True)
    label = models.CharField(max_length=60)
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    user_limit = models.PositiveIntegerField(null=True, blank=True)
    is_free = models.BooleanField(default=False)
    is_custom = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "plan_pricing"
        managed = True


class BillingRecord(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    invoice_number = models.CharField(max_length=30, unique=True, null=True, blank=True)
    billing_period = models.CharField(max_length=20)
    plan_code = models.CharField(max_length=50)
    active_employee_count = models.PositiveIntegerField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=30, default="generated")
    generated_at = models.DateTimeField()
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "billing_records"
        managed = True
        unique_together = (("organization", "billing_period"),)


class SurveyCampaign(models.Model):
    title = models.CharField(max_length=180)
    channel = models.CharField(max_length=40, default="google_forms")
    target_min = models.PositiveIntegerField(default=20)
    target_max = models.PositiveIntegerField(default=30)
    status = models.CharField(max_length=30, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "survey_campaigns"
        managed = True


class SurveyResponse(models.Model):
    survey_campaign = models.ForeignKey(SurveyCampaign, on_delete=models.CASCADE, db_column="survey_campaign_id")
    respondent_role = models.CharField(max_length=120, null=True, blank=True)
    industry = models.CharField(max_length=120, null=True, blank=True)
    answers_json = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "survey_responses"
        managed = True


class AccountingIntegration(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    provider = models.CharField(max_length=60)
    endpoint_url = models.CharField(max_length=255)
    auth_type = models.CharField(max_length=40, default="bearer")
    secret_ref = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounting_integrations"
        managed = True


class AccountingIntegrationMapping(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    hrms_component = models.CharField(max_length=120)
    ledger_account_code = models.CharField(max_length=80)
    ledger_account_name = models.CharField(max_length=180, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounting_integration_mappings"
        managed = True
