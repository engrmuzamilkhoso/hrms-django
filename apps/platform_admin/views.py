"""
Template views for /super-admin/*. Full data-backed ports (organizations
CRUD, billing, health) land in the "Ops & platform" migration phase; these
are the shell/routing skeleton needed so the super-admin login/nav flow is
testable end-to-end now (see apps.super-admin.layout.tsx port at
templates/partials/super_admin_shell.html).
"""

from django.shortcuts import render

from apps.core.decorators import super_admin_required


@super_admin_required
def super_dashboard(request):
    return render(request, "platform_admin/dashboard.html", {})


@super_admin_required
def organizations(request):
    return render(request, "platform_admin/organizations.html", {})


@super_admin_required
def billing(request):
    return render(request, "platform_admin/billing.html", {})


@super_admin_required
def health(request):
    return render(request, "platform_admin/health.html", {})


@super_admin_required
def legacy_admin(request):
    return render(request, "platform_admin/legacy_admin.html", {})
