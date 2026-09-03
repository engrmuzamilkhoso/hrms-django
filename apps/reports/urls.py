from django.urls import path

from apps.core.decorators import admin_required

from . import views

app_name = "reports"

urlpatterns = [
    path("", admin_required(views.reports_home), name="home"),
]
