from django.urls import path

from . import api

urlpatterns = [
    path("onboarding-tasks", api.OnboardingTaskListCreateAPIView.as_view()),
    path("onboarding-tasks/<int:task_id>", api.OnboardingTaskDetailAPIView.as_view()),
]
