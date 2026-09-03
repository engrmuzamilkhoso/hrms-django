"""
Root URLconf. Page-route prefixes mirror the original Next.js paths
(saas-hrms-frontend/app/**/page.tsx) so bookmarks/links keep working; the
Django app that implements a route is an internal organizational choice and
doesn't always match the URL prefix 1:1 (e.g. the "people" app serves both
/dashboard/employees/ and /platform/designations/ - see apps/people/urls.py).
/api/v1/* mirrors routes/api.php exactly, same paths and verbs, for byte-
level compatibility with any existing bookmarks/integrations.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

import apps.accounts.api_urls as accounts_api_urls
import apps.ai_billing.api_urls as ai_billing_api_urls
import apps.attendance.api_urls as attendance_api_urls
import apps.communication.api_urls as communication_api_urls
import apps.company_assets.api_urls as company_assets_api_urls
import apps.core.api_urls as core_api_urls
import apps.core.stub_urls as core_stub_urls
import apps.exit_mgmt.api_urls as exit_mgmt_api_urls
import apps.leave.api_urls as leave_api_urls
import apps.onboarding.api_urls as onboarding_api_urls
import apps.organization.api_urls as organization_api_urls
import apps.payroll.api_urls as payroll_api_urls
import apps.people.api_urls as people_api_urls
import apps.people.urls as people_urls
import apps.performance.api_urls as performance_api_urls
import apps.platform_admin.api_urls as platform_admin_api_urls
import apps.recruitment.api_urls as recruitment_api_urls
import apps.reports.api_urls as reports_api_urls
from apps.core import views as core_views
from apps.payroll.urls import accounting_urlpatterns as payroll_accounting_urls
from apps.people import views as people_views
from apps.platform_admin.urls import legacy_admin_urlpatterns as platform_legacy_urls

api_v1_urlpatterns = [
    *core_api_urls.urlpatterns,
    *accounts_api_urls.urlpatterns,
    *people_api_urls.urlpatterns,
    *organization_api_urls.urlpatterns,
    *attendance_api_urls.urlpatterns,
    *leave_api_urls.urlpatterns,
    *payroll_api_urls.urlpatterns,
    *recruitment_api_urls.urlpatterns,
    *ai_billing_api_urls.urlpatterns,
    *exit_mgmt_api_urls.urlpatterns,
    *onboarding_api_urls.urlpatterns,
    *performance_api_urls.urlpatterns,
    *company_assets_api_urls.urlpatterns,
    *communication_api_urls.urlpatterns,
    *reports_api_urls.urlpatterns,
    *platform_admin_api_urls.accounting_urlpatterns,
    *core_stub_urls.urlpatterns,
    path("platform/", include(platform_admin_api_urls.platform_urlpatterns)),
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("", core_views.landing, name="landing"),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.core.urls")),
    path("platform/users/", include("apps.access.urls")),
    path(
        "dashboard/employees/",
        include((people_urls.employee_urlpatterns, "people"), namespace="people"),
    ),
    path(
        "platform/designations/",
        include((people_urls.designation_urlpatterns, "people"), namespace="people_designations"),
    ),
    path("dashboard/organization/", include("apps.organization.urls")),
    path("platform/attendance/", include("apps.attendance.urls")),
    path("platform/leave/", include("apps.leave.urls")),
    path("platform/payroll/", include("apps.payroll.urls")),
    path("platform/", include((payroll_accounting_urls, "payroll"), namespace="payroll_accounting")),
    path("platform/recruitment/", include("apps.recruitment.urls")),
    path("platform/performance/", include("apps.performance.urls")),
    path("platform/onboarding-exit/", include("apps.onboarding.urls")),
    path("platform/assets/", include("apps.company_assets.urls")),
    path("platform/notifications/", include("apps.communication.urls")),
    path("platform/reports/", include("apps.reports.urls")),
    path("platform/ai-billing/", include("apps.ai_billing.urls")),
    path("super-admin/", include("apps.platform_admin.urls")),
    path("platform/", include((platform_legacy_urls, "platform_legacy"), namespace="platform_legacy")),
    path("employees/", people_views.legacy_employees, name="legacy_employees"),
    path("api/v1/", include(api_v1_urlpatterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
