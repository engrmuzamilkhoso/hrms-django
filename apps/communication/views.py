from django.shortcuts import render

from apps.core.decorators import login_required_view

EVENT_KEYS = [
    "leave_approved", "leave_rejected", "payslip_ready", "document_expiring",
    "birthday_reminder", "probation_expiry", "payroll_approval_required",
    "task_assigned", "clearance_overdue",
]


@login_required_view
def notifications(request):
    """Full visual port of app/platform/notifications/page.tsx."""
    event_keys = [(k, k.replace("_", " ")) for k in EVENT_KEYS]
    return render(request, "communication/notifications.html", {"event_keys": event_keys})
