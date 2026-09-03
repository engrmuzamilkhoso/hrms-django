import json

from django.shortcuts import render

from apps.core.decorators import admin_required

ASSIGNABLE_ROLES = ["Org Admin", "HR Manager", "Team Lead", "Employee", "Finance Viewer", "Recruiter", "Interviewer"]


@admin_required
def users_page(request):
    """Full visual port of app/platform/users/page.tsx."""
    roles_json = json.dumps([{"value": r, "label": r} for r in ASSIGNABLE_ROLES])
    return render(request, "access/users.html", {"roles_json": roles_json})
