from django.urls import path

from . import views

app_name = "ai_billing"

urlpatterns = [
    path("", views.home, name="home"),
]
