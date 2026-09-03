from functools import partial

from django.urls import path

from apps.core.decorators import admin_required
from apps.core.placeholder_views import module_placeholder

app_name = "ai_billing"

urlpatterns = [
    path("", admin_required(partial(module_placeholder, title="AI & Credits")), name="home"),
]
