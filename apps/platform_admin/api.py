"""
DRF views for /api/v1/platform/* (super-admin, IsSuperAdmin-gated) and the
tenant-scoped /api/v1/accounting-integration* routes (Platform-namespaced in
Laravel despite living outside the /platform prefix - kept as-is, see plan's
"known source-app quirks"). Ported from Platform\\{OrganizationAdminController,
PlanPricingController,BillingController,HealthController,SurveyController,
AccountingIntegrationController}.php.
"""

import re

import requests
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.access.models import Role, UserRoleAssignment
from apps.accounts.models import User
from apps.core.permissions import IsSuperAdmin
from apps.core.views import EnvelopeAPIView
from apps.organization.models import Organization, OrganizationSetting
from apps.organization.serializers import OrganizationSerializer
from apps.people.models import Employee

from .models import (
    AccountingIntegration,
    AccountingIntegrationMapping,
    BillingRecord,
    PlanPricing,
    SurveyCampaign,
    SurveyResponse,
)
from .serializers import (
    AccountingIntegrationMappingSerializer,
    AccountingIntegrationSerializer,
    BillingRecordSerializer,
    PlanPricingSerializer,
    SurveyCampaignSerializer,
)
from .services import generate_billing

PLAN_LIMITS = {"trial": 20, "silver": 30, "gold": 50, "platinum": 100}
PREDEFINED_ROLES = ["Org Admin", "HR Manager", "Team Lead", "Employee", "Finance Viewer", "Recruiter", "Interviewer"]


class OrganizationAdminListCreateAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = Organization.objects.all().order_by("-id")
        # Mirrors Organization::addSelect(['employee_count' => ...]) via a
        # per-row annotation on the paginated slice.
        from apps.core.pagination import paginate

        data = paginate(request, qs, OrganizationSerializer)
        for row in data["data"]:
            row["employee_count"] = Employee.all_objects.filter(
                organization_id=row["id"], employment_status="active"
            ).count()
        return self.ok(data)

    @transaction.atomic
    def post(self, request):
        data = request.data
        plan_code = data["plan_code"]
        plan_row = PlanPricing.objects.filter(plan_code=plan_code).first()
        user_limit = (
            int(data["custom_user_limit"])
            if plan_code == "custom"
            else (plan_row.user_limit if plan_row else PLAN_LIMITS.get(plan_code, 20))
        )

        org = Organization.objects.create(
            name=data["organization_name"],
            country_code=data["country_code"].upper(),
            industry=data["industry"],
            default_currency=data["default_currency"].upper(),
            timezone=data["timezone"],
            status="active",
            plan_code=plan_code,
            trial_user_limit=user_limit,
            custom_monthly_price=data.get("custom_monthly_price") if plan_code == "custom" else None,
            ai_credit_balance=100,
        )
        OrganizationSetting.objects.create(
            organization=org, hr_mode="global", free_tier_employee_limit=user_limit,
            low_ai_credit_threshold=50, seed_data_enabled=True,
        )
        admin = User.objects.create_user(
            organization=org, name=data["admin_name"], email=data["admin_email"], password=data["password"],
            is_active=True,
        )
        for role_name in PREDEFINED_ROLES:
            Role.objects.get_or_create(
                organization=org, name=role_name, defaults={"description": role_name, "is_system": True}
            )
        org_admin_role = Role.objects.filter(organization=org, name="Org Admin").first()
        if org_admin_role:
            UserRoleAssignment.objects.get_or_create(user=admin, role=org_admin_role)

        return self.ok(
            {
                "organization": OrganizationSerializer(org).data,
                "admin": {"name": admin.name, "email": admin.email},
            },
            "Organization created successfully.",
            201,
        )


class OrganizationAdminActivateAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, org_id):
        org = get_object_or_404(Organization, pk=org_id)
        org.status = "active"
        org.save()
        return self.ok(OrganizationSerializer(org).data, "Organization activated.")


class OrganizationAdminSuspendAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, org_id):
        org = get_object_or_404(Organization, pk=org_id)
        org.status = "inactive"
        org.save()
        return self.ok(OrganizationSerializer(org).data, "Organization deactivated.")


class OrganizationAdminUpdateAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def patch(self, request, org_id):
        org = get_object_or_404(Organization, pk=org_id)
        data = request.data

        if data.get("plan_code") and data["plan_code"] != "custom":
            plan_row = PlanPricing.objects.filter(plan_code=data["plan_code"]).first()
            org.trial_user_limit = plan_row.user_limit if plan_row else PLAN_LIMITS.get(data["plan_code"], 20)
            org.custom_monthly_price = None
            org.plan_code = data["plan_code"]
        else:
            for field in ["plan_code", "trial_user_limit", "custom_monthly_price", "status"]:
                if field in data:
                    setattr(org, field, data[field])
        org.save()
        return self.ok(OrganizationSerializer(org).data, "Organization updated.")


class PlanPricingListAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        order = ["trial", "silver", "gold", "platinum", "custom"]
        plans = sorted(PlanPricing.objects.all(), key=lambda p: order.index(p.plan_code) if p.plan_code in order else 99)
        return self.ok(PlanPricingSerializer(plans, many=True).data)


class PlanPricingUpdateAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def patch(self, request, plan_code):
        plan = get_object_or_404(PlanPricing, plan_code=plan_code)
        if plan.is_free:
            return self.error("Trial plan price cannot be changed.", 422)
        plan.monthly_price = request.data["monthly_price"]
        plan.save()
        return self.ok(PlanPricingSerializer(plan).data, "Plan price updated.")


class BillingListAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = BillingRecord.objects.select_related("organization").order_by("-generated_at")
        status_ = request.query_params.get("status")
        if status_ and status_ != "all":
            qs = qs.filter(status=status_)
        period = request.query_params.get("period")
        if period:
            qs = qs.filter(billing_period=period)
        return self.paginated_ok(request, qs, BillingRecordSerializer, default_per_page=50)


class BillingDetailAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, record_id):
        record = get_object_or_404(BillingRecord.objects.select_related("organization"), pk=record_id)
        return self.ok(BillingRecordSerializer(record).data)


class BillingGenerateAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, period):
        if not re.match(r"^\d{4}-\d{2}$", period):
            return self.error("Invalid period format. Use YYYY-MM.", 422)

        records = generate_billing(period)
        generated = [BillingRecordSerializer(r).data for r in records]
        return self.ok({"generated": generated, "count": len(generated)}, "Invoices generated successfully.")


class BillingMarkPaidAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, record_id):
        record = get_object_or_404(BillingRecord, pk=record_id)
        record.status = "paid"
        record.paid_at = timezone.now()
        record.save()
        return self.ok(BillingRecordSerializer(record).data, "Invoice marked as paid.")


class BillingPeriodsAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        periods = list(
            BillingRecord.objects.order_by("-billing_period").values_list("billing_period", flat=True).distinct()
        )
        return self.ok(periods)


class HealthOverviewAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        return self.ok(
            {"api": "ok", "queue": "unknown", "db": "unknown", "timestamp": timezone.now().isoformat()}
        )


class SurveyCampaignsAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = SurveyCampaign.objects.order_by("-id")
        return self.ok(SurveyCampaignSerializer(qs, many=True).data)

    def post(self, request):
        data = request.data
        campaign = SurveyCampaign.objects.create(
            title=data["title"], channel=data.get("channel", "google_forms"),
            target_min=data.get("target_min", 20), target_max=data.get("target_max", 30), status="active",
        )
        return self.ok({"id": campaign.id}, "Survey campaign created", 201)


class SurveySubmitResponseAPIView(EnvelopeAPIView):
    def post(self, request, campaign_id):
        data = request.data
        SurveyResponse.objects.create(
            survey_campaign_id=campaign_id, respondent_role=data.get("respondent_role"),
            industry=data.get("industry"), answers_json=data["answers_json"],
        )
        return self.ok(None, "Survey response submitted", 201)


class SurveyPrioritizeAPIView(EnvelopeAPIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, campaign_id):
        responses = SurveyResponse.objects.filter(survey_campaign_id=campaign_id)
        scores = {}
        for r in responses:
            answers = r.answers_json or {}
            pain = answers.get("pain_point", "general")
            severity = int(answers.get("severity", 3))
            company_size = int(answers.get("company_size", 100))
            normalized_weight = min(5, max(1, -(-company_size // 200)))

            entry = scores.setdefault(pain, {"frequency": 0, "weighted": 0})
            entry["frequency"] += 1
            entry["weighted"] += (severity * 2) + normalized_weight

        result = [
            {"pain_point": k, "frequency": v["frequency"], "priority_score": v["weighted"] + v["frequency"]}
            for k, v in scores.items()
        ]
        result.sort(key=lambda x: x["priority_score"], reverse=True)
        return self.ok(result)


class AccountingIntegrationAPIView(EnvelopeAPIView):
    def get(self, request):
        integration = AccountingIntegration.objects.filter(organization_id=request.user.organization_id).first()
        mappings = AccountingIntegrationMapping.objects.filter(organization_id=request.user.organization_id)
        return self.ok(
            {
                "integration": AccountingIntegrationSerializer(integration).data if integration else None,
                "mappings": AccountingIntegrationMappingSerializer(mappings, many=True).data,
            },
            "Accounting integration retrieved",
        )

    def post(self, request):
        data = request.data
        integration, _ = AccountingIntegration.objects.update_or_create(
            organization_id=request.user.organization_id,
            defaults=dict(
                provider=data["provider"], endpoint_url=data["endpoint_url"],
                auth_type=data.get("auth_type", "bearer"), secret_ref=data.get("secret_ref"),
                is_active=data.get("is_active", True),
            ),
        )
        return self.ok(AccountingIntegrationSerializer(integration).data, "Integration saved")


class AccountingIntegrationMappingsAPIView(EnvelopeAPIView):
    def post(self, request):
        org_id = request.user.organization_id
        AccountingIntegrationMapping.objects.filter(organization_id=org_id).delete()
        for m in request.data["mappings"]:
            AccountingIntegrationMapping.objects.create(
                organization_id=org_id, hrms_component=m["hrms_component"],
                ledger_account_code=m["ledger_account_code"], ledger_account_name=m.get("ledger_account_name"),
            )
        return self.ok(None, "Mappings saved")


class AccountingPushPayrollJournalAPIView(EnvelopeAPIView):
    def post(self, request, payroll_run_id):
        from apps.payroll.models import PayrollItem, PayrollRun

        org_id = request.user.organization_id
        integration = AccountingIntegration.objects.filter(organization_id=org_id, is_active=True).first()
        if not integration:
            return self.ok(None, "No active accounting integration configured", 200)

        run = get_object_or_404(PayrollRun, pk=payroll_run_id, organization_id=org_id)
        items = PayrollItem.objects.filter(payroll_run_id=payroll_run_id)
        mappings = {
            m.hrms_component: m
            for m in AccountingIntegrationMapping.objects.filter(organization_id=org_id)
        }

        lines = [
            {
                "component": item.component_name, "type": item.component_type, "amount": str(item.amount),
                "ledger_code": (mappings[item.component_name].ledger_account_code if item.component_name in mappings else None),
                "ledger_name": (
                    mappings[item.component_name].ledger_account_name
                    if item.component_name in mappings else item.component_name
                ),
            }
            for item in items
        ]
        payload = {
            "payroll_run_id": run.id, "period_start": str(run.period_start), "period_end": str(run.period_end),
            "total_gross": str(run.total_gross), "total_net": str(run.total_net),
            "total_deductions": str(run.total_deductions), "journal_lines": lines,
        }

        headers = {}
        if integration.auth_type == "bearer":
            headers = {"Authorization": f"Bearer {integration.secret_ref}"}
        elif integration.auth_type == "api_key":
            headers = {"X-API-Key": integration.secret_ref}

        try:
            response = requests.post(integration.endpoint_url, json=payload, headers=headers, timeout=15)
            if not response.ok:
                return self.ok({"http_status": response.status_code, "body": response.text}, "Push failed — see details", 200)
            return self.ok({"http_status": response.status_code}, "Journal entry pushed to accounting system")
        except requests.RequestException as e:
            return self.ok({"error": str(e)}, "Push failed — retryable", 200)
