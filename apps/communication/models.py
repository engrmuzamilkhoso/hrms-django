"""Mirrors Communication\\{NotificationController,NotificationPreferenceController} models."""

from django.db import models

from apps.core.models import TenantScopedModel
from apps.organization.models import Organization


class Notification(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    user_id = models.BigIntegerField()
    channel = models.CharField(max_length=20, default="in_app")
    title = models.CharField(max_length=190)
    body = models.TextField()
    status = models.CharField(max_length=30, default="pending")
    sent_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notifications"
        managed = True


class NotificationPreference(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    user_id = models.BigIntegerField()
    event_key = models.CharField(max_length=80)
    in_app_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)
    whatsapp_enabled = models.BooleanField(default=False)
    digest_mode = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notification_preferences"
        managed = True
        unique_together = (("user_id", "event_key"),)
