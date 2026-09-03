from rest_framework import serializers

from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id", "organization_id", "user_id", "channel", "title", "body", "status",
            "sent_at", "read_at", "created_at", "updated_at",
        ]


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            "id", "organization_id", "user_id", "event_key", "in_app_enabled", "email_enabled",
            "sms_enabled", "whatsapp_enabled", "digest_mode", "created_at", "updated_at",
        ]
