from django.urls import path

from . import views

app_name = "access"

# Mounted at /platform/users/ in hrms/urls.py (matches
# app/platform/users/page.tsx - user/role management, not linked from the
# sidebar nav in the source app but still routed and admin-gated there).
urlpatterns = [
    path("", views.users_page, name="users"),
]
