"""Ported from app/Services/AuditLogService.php."""

from .models import AuditLog


def log_action(request, action, entity_type, entity_id, before=None, after=None):
    user = getattr(request, "user", None)
    AuditLog.objects.create(
        organization_id=(getattr(user, "organization_id", None) or 0),
        actor_user_id=getattr(user, "id", None),
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_json=before or None,
        after_json=after or None,
        ip_address=request.META.get("REMOTE_ADDR"),
        user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:255],
    )
