from django.urls import path

from . import views

app_name = "platform_admin"

urlpatterns = [
    path("", views.super_dashboard, name="super_dashboard"),
    path("organizations/", views.organizations, name="organizations"),
    path("billing/", views.billing, name="billing"),
    path("health/", views.health, name="health"),
]

# Mounted separately at /platform/admin/ in hrms/urls.py (matches the
# original app/platform/admin/page.tsx path, distinct from /super-admin/*
# even though this app also owns the super-admin console views).
legacy_admin_urlpatterns = [
    path("admin/", views.legacy_admin, name="legacy_admin"),
]
