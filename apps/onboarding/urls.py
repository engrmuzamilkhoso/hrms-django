from django.urls import path

from apps.core.decorators import admin_required

from . import views

app_name = "onboarding"

# Matches /platform/onboarding-exit (app/platform/onboarding-exit/page.tsx) -
# one combined view/module for onboarding tasks + exit workflows, per the
# original single-page grouping (nav label "Onboarding & Exit").
urlpatterns = [
    path("", admin_required(views.onboarding_exit_home), name="home"),
]
