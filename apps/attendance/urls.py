from django.urls import path

from apps.core.decorators import admin_required, login_required_view

from . import views

app_name = "attendance"

urlpatterns = [
    path("", login_required_view(views.attendance_home), name="home"),
    path(
        "holidays-shifts/",
        admin_required(views.holidays_shifts),
        name="holidays_shifts",
    ),
]
