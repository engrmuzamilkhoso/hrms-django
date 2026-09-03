"""Direct port of app/Services/NotificationService.php."""

import logging

from django.utils import timezone

from .models import Notification, NotificationPreference

logger = logging.getLogger(__name__)


def send_notification(organization_id, user_id, title, body, channels=None):
    channels = channels or ["in_app"]
    event_key = title.lower().replace(" ", "_")

    pref = NotificationPreference.objects.filter(user_id=user_id, event_key=event_key).first()
    if pref:
        channel_allowed = {
            "in_app": pref.in_app_enabled,
            "email": pref.email_enabled,
            "sms": pref.sms_enabled,
            "whatsapp": pref.whatsapp_enabled,
        }
        channels = [c for c in channels if channel_allowed.get(c, False)]
        if pref.digest_mode:
            channels = ["in_app"]

    for channel in channels:
        Notification.objects.create(
            organization_id=organization_id,
            user_id=user_id,
            channel=channel,
            title=title,
            body=body,
            status="sent" if channel == "in_app" else "queued",
            sent_at=timezone.now() if channel == "in_app" else None,
        )
        if channel != "in_app":
            logger.info(
                "notification_dispatch_queued organization_id=%s user_id=%s channel=%s title=%s",
                organization_id, user_id, channel, title,
            )
