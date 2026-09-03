from django.urls import path

from apps.core.decorators import admin_required

from . import views

app_name = "company_assets"

urlpatterns = [
    path("", admin_required(views.assets_home), name="home"),
]
