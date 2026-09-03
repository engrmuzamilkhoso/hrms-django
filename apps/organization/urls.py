from functools import partial

from django.urls import path

from apps.core.decorators import admin_required
from apps.core.placeholder_views import module_placeholder

app_name = "organization"

# Mounted at /dashboard/organization/ in hrms/urls.py (matches
# app/dashboard/organization/*/page.tsx paths).
urlpatterns = [
    path("", admin_required(partial(module_placeholder, title="Organization")), name="overview"),
    path(
        "departments/",
        admin_required(partial(module_placeholder, title="Departments")),
        name="department_list",
    ),
    path("offices/", admin_required(partial(module_placeholder, title="Offices")), name="office_list"),
    path("teams/", admin_required(partial(module_placeholder, title="Teams")), name="team_list"),
]
