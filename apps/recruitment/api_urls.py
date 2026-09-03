from django.urls import path

from . import api

urlpatterns = [
    path("job-postings", api.JobPostingListCreateAPIView.as_view()),
    path("job-postings/<int:job_posting_id>", api.JobPostingDetailAPIView.as_view()),
    path("candidates", api.CandidateListCreateAPIView.as_view()),
    path("candidates/<int:candidate_id>", api.CandidateDetailAPIView.as_view()),
    path("candidates/<int:candidate_id>/stage", api.CandidateMoveStageAPIView.as_view()),
    path("candidates/<int:candidate_id>/accept-offer", api.CandidateAcceptOfferAPIView.as_view()),
    path("candidate-portal/linkedin/auth-url", api.LinkedinAuthUrlAPIView.as_view()),
    path("candidate-portal/magic-link", api.RequestMagicLinkAPIView.as_view()),
    path("candidate-portal/status", api.StatusByMagicTokenAPIView.as_view()),
    path("candidate-portal/linkedin/callback", api.LinkedinApplyCallbackAPIView.as_view()),
]
