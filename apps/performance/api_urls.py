from django.urls import path

from . import api

urlpatterns = [
    path("performance-cycles", api.PerformanceCycleListCreateAPIView.as_view()),
    path("goals", api.GoalListCreateAPIView.as_view()),
    path("promotions/<int:promotion_request_id>/approve", api.PromotionApproveAPIView.as_view()),
]
