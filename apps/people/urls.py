from django.urls import path

from apps.core.decorators import admin_required

from . import views

app_name = "people"

# Mounted at /dashboard/employees/ in hrms/urls.py (matches
# app/dashboard/employees/*/page.tsx paths).
employee_urlpatterns = [
    path("", admin_required(views.employee_list), name="employee_list"),
    path("create/", admin_required(views.employee_create), name="employee_create"),
    path("import/", admin_required(views.employee_import), name="employee_import"),
    path("<int:employee_id>/", admin_required(views.employee_detail), name="employee_detail"),
]

# Mounted separately at /platform/designations/ in hrms/urls.py (matches
# app/platform/designations/page.tsx).
designation_urlpatterns = [
    path("", admin_required(views.designation_list), name="designation_list"),
]
