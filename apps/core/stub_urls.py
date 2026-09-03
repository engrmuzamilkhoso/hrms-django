"""
Registers the same unimplemented placeholder endpoints System\\StubController
backed in Laravel (routes/api.php's closures using StubController::action).
"""

from django.urls import path

from .api import StubAPIView

urlpatterns = [
    path("interviews/", StubAPIView.as_view(module="interviews")),
    path("interviews/<str:id>/", StubAPIView.as_view(module="interviews")),
    path("recruitment/cv-parse", StubAPIView.as_view(module="recruitment", stub_action="cv-parse")),
    path("recruitment/cv-score", StubAPIView.as_view(module="recruitment", stub_action="cv-score")),
    path("payroll-runs/<str:id>/payslips", StubAPIView.as_view(module="payroll-runs", stub_action="payslips")),
    path("payslips/<str:id>/download", StubAPIView.as_view(module="payslips", stub_action="download")),
]
