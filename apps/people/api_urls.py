from django.urls import path

from . import account_api as acct
from . import api, subresource_api as sub
from .import_api import EmployeeImportAPIView

urlpatterns = [
    path("designations", api.DesignationListCreateAPIView.as_view()),
    path("designations/assign", api.DesignationAssignAPIView.as_view()),
    path("designations/<int:designation_id>", api.DesignationDetailAPIView.as_view()),
    path("employees/<int:employee_id>/designation-history", api.DesignationHistoryAPIView.as_view()),
    path("employees/import", EmployeeImportAPIView.as_view()),
    path("employees", api.EmployeeListCreateAPIView.as_view()),
    path("employees/<int:employee_id>", api.EmployeeDetailAPIView.as_view()),
    path("employees/<int:employee_id>/bank-accounts", sub.BankAccountListCreateAPIView.as_view()),
    path("employees/<int:employee_id>/bank-accounts/<int:account_id>", sub.BankAccountDetailAPIView.as_view()),
    path("employees/<int:employee_id>/emergency-contacts", sub.EmergencyContactListCreateAPIView.as_view()),
    path("employees/<int:employee_id>/emergency-contacts/<int:contact_id>", sub.EmergencyContactDetailAPIView.as_view()),
    path("employees/<int:employee_id>/education", sub.EducationListCreateAPIView.as_view()),
    path("employees/<int:employee_id>/education/<int:education_id>", sub.EducationDetailAPIView.as_view()),
    path("employees/<int:employee_id>/experience", sub.ExperienceListCreateAPIView.as_view()),
    path("employees/<int:employee_id>/experience/<int:experience_id>", sub.ExperienceDetailAPIView.as_view()),
    path("employee-documents", sub.DocumentListCreateAPIView.as_view()),
    path("employee-documents/expiring-soon", sub.DocumentExpiringSoonAPIView.as_view()),
    path("employee-documents/<int:document_id>", sub.DocumentDetailAPIView.as_view()),
    path("probation-reviews", sub.ProbationReviewListCreateAPIView.as_view()),
    path("probation-reviews/upcoming", sub.ProbationReviewUpcomingAPIView.as_view()),
    path("probation-reviews/<int:review_id>/outcome", sub.ProbationReviewOutcomeAPIView.as_view()),
    path("employees/<int:employee_id>/account", acct.EmployeeAccountAPIView.as_view()),
    path("employees/<int:employee_id>/account/reset-password", acct.EmployeeAccountResetPasswordAPIView.as_view()),
    path("employees/<int:employee_id>/account/deactivate", acct.EmployeeAccountDeactivateAPIView.as_view()),
    path("employees/<int:employee_id>/account/activate", acct.EmployeeAccountActivateAPIView.as_view()),
]
