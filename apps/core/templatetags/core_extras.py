import json

from django import template
from django.utils.safestring import mark_safe

register = template.Library()

# Mirrors the STATUS_BADGE color maps repeated across React pages (e.g.
# app/dashboard/employees/page.tsx:26-31, app/platform/leave/page.tsx:72-76).
STATUS_BADGE_MAP = {
    "active": "badge-green",
    "approved": "badge-green",
    "valid": "badge-green",
    "paid": "badge-green",
    "completed": "badge-green",
    "passed": "badge-green",
    "included_in_payroll": "badge-green",
    "pending": "badge-amber",
    "pending_hr": "badge-amber",
    "on_leave": "badge-amber",
    "expiring_soon": "badge-amber",
    "draft": "badge-slate",
    "inactive": "badge-slate",
    "generated": "badge-slate",
    "in_progress": "badge-blue",
    "rejected": "badge-red",
    "terminated": "badge-red",
    "expired": "badge-red",
    "cancelled": "badge-red",
    "suspended": "badge-red",
}


@register.filter
def to_json(value):
    return mark_safe(json.dumps(value))


@register.filter
def badge_class(status):
    if not status:
        return "badge-slate"
    return STATUS_BADGE_MAP.get(str(status).lower(), "badge-slate")


@register.filter
def get_item(mapping, key):
    if mapping is None:
        return None
    try:
        return mapping.get(key)
    except AttributeError:
        return None
