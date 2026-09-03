from django.urls import path

from . import views

app_name = "communication"

urlpatterns = [
    path("", views.notifications, name="notifications"),
]
