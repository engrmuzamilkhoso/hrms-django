from functools import partial

from django.urls import path

from apps.core.decorators import admin_required
from apps.core.placeholder_views import module_placeholder

app_name = "access"

# Mounted at /platform/users/ in hrms/urls.py (matches
# app/platform/users/page.tsx - user/role management, not linked from the
# sidebar nav in the source app but still routed and admin-gated there).
urlpatterns = [
    path("", admin_required(partial(module_placeholder, title="Users & Roles")), name="users"),
]
