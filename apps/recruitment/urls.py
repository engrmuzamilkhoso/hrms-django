from django.urls import path

from apps.core.decorators import admin_required

from . import views

app_name = "recruitment"

urlpatterns = [
    path("", admin_required(views.recruitment_home), name="home"),
]
