from django.urls import path

from . import api

# Mounted at /api/v1/platform/ (super-admin, IsSuperAdmin-gated).
platform_urlpatterns = [
    path("organizations", api.OrganizationAdminListCreateAPIView.as_view()),
    path("organizations/<int:org_id>", api.OrganizationAdminUpdateAPIView.as_view()),
    path("organizations/<int:org_id>/activate", api.OrganizationAdminActivateAPIView.as_view()),
    path("organizations/<int:org_id>/suspend", api.OrganizationAdminSuspendAPIView.as_view()),
    path("plan-pricing", api.PlanPricingListAPIView.as_view()),
    path("plan-pricing/<str:plan_code>", api.PlanPricingUpdateAPIView.as_view()),
    path("billing/records", api.BillingListAPIView.as_view()),
    path("billing/periods", api.BillingPeriodsAPIView.as_view()),
    path("billing/records/<int:record_id>", api.BillingDetailAPIView.as_view()),
    path("billing/generate/<str:period>", api.BillingGenerateAPIView.as_view()),
    path("billing/records/<int:record_id>/mark-paid", api.BillingMarkPaidAPIView.as_view()),
    path("health/overview", api.HealthOverviewAPIView.as_view()),
    path("surveys/campaigns", api.SurveyCampaignsAPIView.as_view()),
    path("surveys/campaigns/<int:campaign_id>/responses", api.SurveySubmitResponseAPIView.as_view()),
    path("surveys/campaigns/<int:campaign_id>/prioritize", api.SurveyPrioritizeAPIView.as_view()),
]

# Mounted at /api/v1/ directly (tenant-scoped despite the Platform namespace
# in Laravel - see plan's "known source-app quirks", kept where it is).
accounting_urlpatterns = [
    path("accounting-integration", api.AccountingIntegrationAPIView.as_view()),
    path("accounting-integration/mappings", api.AccountingIntegrationMappingsAPIView.as_view()),
    path("accounting-integration/push-journal/<int:payroll_run_id>", api.AccountingPushPayrollJournalAPIView.as_view()),
]
