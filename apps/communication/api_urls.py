from django.urls import path

from . import api

urlpatterns = [
    path("notifications", api.NotificationListAPIView.as_view()),
    path("notifications/<int:notification_id>/read", api.NotificationMarkReadAPIView.as_view()),
    path("notification-preferences", api.NotificationPreferenceListAPIView.as_view()),
]
