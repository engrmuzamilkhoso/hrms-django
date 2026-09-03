from django.shortcuts import render

from apps.core.decorators import admin_required


@admin_required
def overview(request):
    """Full visual port of app/dashboard/organization/page.tsx."""
    return render(request, "organization/overview.html", {})


@admin_required
def department_list(request):
    """Full visual port of app/dashboard/organization/departments/page.tsx."""
    return render(request, "organization/departments.html", {})


@admin_required
def office_list(request):
    """Full visual port of app/dashboard/organization/offices/page.tsx +
    offices/create/page.tsx, rebuilt against /offices (the source app's
    fetch calls hit the nonexistent /api/v1/organization/offices - a 404 in
    the original app; ported here against the real, working endpoint)."""
    return render(request, "organization/offices.html", {})


@admin_required
def team_list(request):
    """Full visual port of app/dashboard/organization/teams/page.tsx,
    rebuilt against /teams for the same reason as office_list()."""
    return render(request, "organization/teams.html", {})
