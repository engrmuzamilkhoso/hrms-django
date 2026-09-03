from functools import partial

from django.urls import path

from apps.core.decorators import login_required_view
from apps.core.placeholder_views import module_placeholder

app_name = "communication"

urlpatterns = [
    path(
        "",
        login_required_view(partial(module_placeholder, title="Notifications")),
        name="notifications",
    ),
]
