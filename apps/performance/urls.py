from django.urls import path

from apps.core.decorators import login_required_view

from . import views

app_name = "performance"

# Note: not in adminOnlyPrefixes (platform/layout.tsx:150-155) despite only
# being linked from ADMIN_NAV - any authenticated user could navigate here
# directly in the source app. Preserved as-is rather than newly restricted;
# the real data-access boundary is each API endpoint's own hasRole() check.
urlpatterns = [
    path("", login_required_view(views.performance_home), name="home"),
]
