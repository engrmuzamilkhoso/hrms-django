from django.urls import path

from . import api

urlpatterns = [
    path("organizations/me", api.OrganizationMeAPIView.as_view()),
    path("offices", api.OfficeListCreateAPIView.as_view()),
    path("offices/<int:office_id>", api.OfficeDetailAPIView.as_view()),
    path("departments", api.DepartmentListCreateAPIView.as_view()),
    path("departments/<int:department_id>", api.DepartmentDetailAPIView.as_view()),
    path("teams", api.TeamListCreateAPIView.as_view()),
    path("teams/<int:team_id>", api.TeamDetailAPIView.as_view()),
]
