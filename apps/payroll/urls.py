from django.urls import path

from apps.core.decorators import admin_required

from . import views

app_name = "payroll"

urlpatterns = [
    path("", admin_required(views.payroll_home), name="home"),
]

# Mounted separately at /platform/accounting/ in hrms/urls.py (matches
# app/platform/accounting/page.tsx's path; the Laravel controller behind it
# is namespaced Platform\AccountingIntegrationController despite being a
# tenant-scoped route, not a /platform super-admin one - see plan's "known
# source-app quirks" note. Kept in this app since it's payroll-adjacent).
accounting_urlpatterns = [
    path(
        "accounting/",
        admin_required(views.accounting_integration),
        name="accounting_integration",
    ),
]
