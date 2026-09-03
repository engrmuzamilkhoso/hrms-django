from django.urls import path

from apps.core.decorators import login_required_view

from . import views

app_name = "leave"

# Single tabbed page mirroring app/platform/leave/page.tsx - tabs are
# selected via ?tab= (see the "Leave Policies" nav item's qs suffix in
# apps.core.nav), not separate URLs.
urlpatterns = [
    path("", login_required_view(views.leave_home), name="home"),
]
