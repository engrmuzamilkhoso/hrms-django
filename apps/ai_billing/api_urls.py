from django.urls import path

from . import api

urlpatterns = [
    path("ai-credits/ledger", api.CreditLedgerAPIView.as_view()),
    path("ai-credits/top-up", api.CreditTopUpAPIView.as_view()),
]
