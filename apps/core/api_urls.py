from django.urls import path

from . import api

urlpatterns = [
    path("countries", api.CountryListAPIView.as_view()),
    path("settings/feature-flags", api.FeatureFlagListAPIView.as_view()),
    path("settings/feature-flags/<str:flag_key>", api.FeatureFlagToggleAPIView.as_view()),
]
