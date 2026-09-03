from rest_framework import serializers

from apps.organization.serializers import OrganizationSerializer

from .models import AccountingIntegration, AccountingIntegrationMapping, BillingRecord, PlanPricing, SurveyCampaign


class PlanPricingSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanPricing
        fields = ["id", "plan_code", "label", "monthly_price", "user_limit", "is_free", "is_custom", "created_at", "updated_at"]


class BillingRecordSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)

    class Meta:
        model = BillingRecord
        fields = [
            "id", "organization_id", "invoice_number", "billing_period", "plan_code",
            "active_employee_count", "amount", "currency", "status", "generated_at", "due_date",
            "notes", "paid_at", "created_at", "updated_at", "organization",
        ]


class SurveyCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyCampaign
        fields = ["id", "title", "channel", "target_min", "target_max", "status", "created_at", "updated_at"]


class AccountingIntegrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountingIntegration
        fields = [
            "id", "organization_id", "provider", "endpoint_url", "auth_type", "secret_ref",
            "is_active", "created_at", "updated_at",
        ]


class AccountingIntegrationMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountingIntegrationMapping
        fields = ["id", "organization_id", "hrms_component", "ledger_account_code", "ledger_account_name", "created_at", "updated_at"]
