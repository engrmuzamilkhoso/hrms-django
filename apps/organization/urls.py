from django.urls import path

from . import views

app_name = "organization"

# Mounted at /dashboard/organization/ in hrms/urls.py (matches
# app/dashboard/organization/*/page.tsx paths).
urlpatterns = [
    path("", views.overview, name="overview"),
    path("departments/", views.department_list, name="department_list"),
    path("offices/", views.office_list, name="office_list"),
    path("teams/", views.team_list, name="team_list"),
]
