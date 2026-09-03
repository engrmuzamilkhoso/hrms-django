from django.urls import path

from . import api

urlpatterns = [
    path("reports/headcount", api.HeadcountReportAPIView.as_view()),
    path("reports/attrition", api.AttritionReportAPIView.as_view()),
    path("reports/payroll-register", api.PayrollRegisterAPIView.as_view()),
    path("reports/org-dashboard", api.OrgDashboardAPIView.as_view()),
    path("reports/manager-dashboard", api.ManagerDashboardAPIView.as_view()),
    path("reports/employee-dashboard", api.EmployeeDashboardAPIView.as_view()),
]
