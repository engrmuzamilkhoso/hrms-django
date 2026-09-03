"""
EnvelopeAPIView - Django/DRF equivalent of Laravel's base
App\\Http\\Controllers\\Controller, whose only job was a shared `ok()`
JSON-response helper. Laravel also called `$this->error(...)` from 4
controllers despite it never being defined there (a latent fatal in the
source app) - `.error()` here is a real implementation, not replicated as
a crash (see plan: "fix only dead code").

Also holds the template views for the shared dashboard-home routes
(/platform, /platform/manager, /platform/me) and small legacy routes.
"""

import sys

from django.shortcuts import redirect, render
from rest_framework.response import Response
from rest_framework.views import APIView

from .decorators import admin_required, login_required_view, role_required
from .nav import resolve_home
from .pagination import paginate


def _dbg(msg):
    print(f"[LOGIN-DEBUG] core.views: {msg}", file=sys.stderr, flush=True)


class EnvelopeAPIView(APIView):
    def ok(self, data=None, message="ok", status_code=200):
        return Response({"message": message, "data": data}, status=status_code)

    def error(self, message="Error", status_code=400, errors=None):
        body = {"message": message}
        if errors is not None:
            body["errors"] = errors
        return Response(body, status=status_code)

    def paginated_ok(self, request, queryset, serializer_class, message="ok", **kwargs):
        return self.ok(paginate(request, queryset, serializer_class, **kwargs), message)


LANDING_FEATURES = [
    ("👥", "Employee Management", "Full employee lifecycle — onboarding, records, documents, exit — in one place.", "from-violet-500/20 to-violet-600/5"),
    ("🕐", "Attendance & Shifts", "Clock-in/out, shift management, swap requests, and missing punch alerts.", "from-indigo-500/20 to-indigo-600/5"),
    ("🏖️", "Leave Management", "Leave types, balance tracking, approval workflows, and holiday calendar.", "from-cyan-500/20 to-cyan-600/5"),
    ("💰", "Payroll Processing", "Salary structures, tax rules, payroll runs, payslips, and bank export.", "from-emerald-500/20 to-emerald-600/5"),
    ("🎯", "Performance & Goals", "KPIs, performance cycles, 360° reviews, and promotion tracking.", "from-amber-500/20 to-amber-600/5"),
    ("🔍", "Recruitment", "Job postings, candidate pipeline, interview scheduling, and offer management.", "from-rose-500/20 to-rose-600/5"),
    ("🤖", "AI-Powered Insights", "AI credit system, automated reports, attrition prediction, and smart dashboards.", "from-violet-500/20 to-indigo-500/5"),
    ("🔒", "Role-Based Access", "Granular permissions per role — Org Admin, HR, Team Lead, Employee, Finance.", "from-slate-500/20 to-slate-600/5"),
    ("🏢", "Multi-Tenant SaaS", "Complete tenant isolation, custom plans, organization-level settings.", "from-amber-500/20 to-orange-500/5"),
    ("📊", "Reports & Analytics", "Headcount, attrition, payroll register, and custom report generation.", "from-teal-500/20 to-teal-600/5"),
    ("🌍", "Global Compliance", "Multi-currency, timezone, and country support — built for distributed teams.", "from-blue-500/20 to-blue-600/5"),
    ("🚀", "Onboarding & Exit", "Structured onboarding tasks, clearance workflows, and full exit settlement.", "from-pink-500/20 to-pink-600/5"),
]

LANDING_TESTIMONIALS = [
    ("Sarah Williams", "Head of HR · Global Dynamics", "SW", "WorkForce HRMS completely transformed how we manage our 85-person team. The payroll and leave modules alone saved us 2 days per month. The AI insights are genuinely useful.", "Platinum", "bg-violet-500/20 text-violet-300"),
    ("Alex Johnson", "CEO · TechCorp Solutions", "AJ", "We evaluated 6 HR platforms before choosing WorkForce. The multi-tenant architecture and role-based permissions were exactly what we needed. Setup took less than an hour.", "Gold", "bg-amber-500/20 text-amber-300"),
    ("Omar Khalid", "Operations Manager · StartupHive", "OK", "Switched from spreadsheets to WorkForce HRMS and never looked back. The attendance integration with payroll is seamless. Our employees love the self-service portal.", "Silver", "bg-slate-500/20 text-slate-300"),
    ("Priya Sharma", "HR Director · NexGen Labs", "PS", "The recruitment pipeline cut our time-to-hire by 40%. Having everything from job post to offer letter in one system is a game changer for our growing team.", "Platinum", "bg-violet-500/20 text-violet-300"),
]


def landing(request):
    """Full visual port of app/page.tsx (marketing landing page).
    Authenticated users skip straight past it, matching real-world traffic
    (marketing page is for logged-out visitors).

    Resolves the destination directly rather than redirecting to
    core:home_redirect - that name maps to this same "" pattern (shadowed by
    this view since hrms/urls.py registers landing() first), so redirecting
    to it would bounce straight back here and loop forever."""
    if request.user.is_authenticated:
        roles = request.user.get_role_names()
        return redirect(resolve_home(roles, request.user.is_super_admin))
    return render(request, "core/landing.html", {"features": LANDING_FEATURES, "testimonials": LANDING_TESTIMONIALS})


@login_required_view
def home_redirect(request):
    """Mirrors resolveHome() call sites (dashboard/page.tsx, login redirect)."""
    _dbg("home_redirect: start")
    roles = request.user.get_role_names()
    target = resolve_home(roles, request.user.is_super_admin)
    _dbg(f"home_redirect: roles={roles} -> {target!r}")
    return redirect(target)


@admin_required
def platform_home(request):
    _dbg(f"platform_home: rendering for user_id={request.user.id}")
    return render(request, "core/platform_home.html", {})


@role_required("Team Lead", "Org Admin", "HR Manager")
def manager_home(request):
    _dbg(f"manager_home: rendering for user_id={request.user.id}")
    return render(request, "core/manager_home.html", {})


@login_required_view
def me_home(request):
    _dbg(f"me_home: start for user_id={request.user.id} is_super_admin={request.user.is_super_admin}")
    if request.user.is_super_admin:
        return redirect("platform_admin:super_dashboard")
    _dbg("me_home: rendering template")
    return render(request, "core/me_home.html", {})


@login_required_view
def profile(request):
    return render(request, "core/profile.html", {})


@login_required_view
def legacy_organization_redirect(request):
    """Mirrors app/organization/page.tsx - a pure redirect stub to /platform."""
    return redirect("core:home_redirect")


_MODULE_SECTIONS = [
    {"title": "Foundation", "items": ["Multi-Tenancy", "Auth & RBAC", "Audit Logs", "Feature Flags"]},
    {
        "title": "Core HR",
        "items": ["Organization Setup", "Offices/Departments/Teams", "Employee Profiles", "Document Expiry"],
    },
    {"title": "Operations", "items": ["Attendance", "Leave", "Holiday", "Shift & Overtime", "Payroll"]},
    {"title": "Talent", "items": ["Recruitment", "ATS Pipeline", "Interviewing", "Onboarding/Exit"]},
    {"title": "Insights", "items": ["Dashboards", "Reports", "Billing", "AI Credits", "Anomaly Alerts"]},
]


@login_required_view
def legacy_modules_page(request):
    """Mirrors app/modules/page.tsx - static hardcoded blueprint page, no API calls."""
    return render(request, "core/modules_legacy.html", {"sections": _MODULE_SECTIONS})
