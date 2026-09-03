from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.core.views import EnvelopeAPIView

from .models import Notification, NotificationPreference
from .serializers import NotificationPreferenceSerializer, NotificationSerializer


class NotificationListAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = Notification.objects.order_by("-id")
        return self.paginated_ok(request, qs, NotificationSerializer, default_per_page=30)


class NotificationMarkReadAPIView(EnvelopeAPIView):
    def post(self, request, notification_id):
        notification = get_object_or_404(Notification, pk=notification_id)
        notification.read_at = timezone.now()
        notification.status = "read"
        notification.save()
        return self.ok(NotificationSerializer(notification).data, "Notification marked as read")


class NotificationPreferenceListAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = NotificationPreference.objects.order_by("-id")
        return self.paginated_ok(request, qs, NotificationPreferenceSerializer, default_per_page=50)

    def post(self, request):
        data = request.data
        pref, _ = NotificationPreference.objects.update_or_create(
            user_id=request.user.id, event_key=data["event_key"],
            defaults=dict(
                in_app_enabled=data.get("in_app_enabled", True),
                email_enabled=data.get("email_enabled", True),
                sms_enabled=data.get("sms_enabled", False),
                whatsapp_enabled=data.get("whatsapp_enabled", False),
                digest_mode=data.get("digest_mode", False),
                organization_id=request.user.organization_id,
            ),
        )
        return self.ok(NotificationPreferenceSerializer(pref).data, "Notification preferences saved")
