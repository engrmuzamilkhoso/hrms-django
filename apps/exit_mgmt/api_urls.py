from django.urls import path

from . import api

urlpatterns = [
    path("exit-workflows", api.ExitWorkflowListCreateAPIView.as_view()),
    path("exit-workflows/<int:workflow_id>/calculate-settlement", api.ExitCalculateSettlementAPIView.as_view()),
    path("exit-workflows/<int:workflow_id>/finalize-settlement", api.ExitFinalizeAPIView.as_view()),
]
