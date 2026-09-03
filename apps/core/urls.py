from django.urls import path

from . import views

app_name = "core"

urlpatterns = [
    # Matches app/dashboard/page.tsx - a role-based redirect router distinct
    # from "/" (core_views.landing, wired ahead of this include in
    # hrms/urls.py so it owns the bare root; see landing()'s docstring).
    path("dashboard/", views.home_redirect, name="home_redirect"),
    path("platform/", views.platform_home, name="platform_home"),
    path("platform/manager/", views.manager_home, name="manager_home"),
    path("platform/me/", views.me_home, name="me_home"),
    path("platform/profile/", views.profile, name="profile"),
    path("organization/", views.legacy_organization_redirect, name="legacy_organization_redirect"),
    path("modules/", views.legacy_modules_page, name="legacy_modules"),
]
