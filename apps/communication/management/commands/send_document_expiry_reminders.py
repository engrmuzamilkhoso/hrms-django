"""Port of App\\Jobs\\SendDocumentExpiryRemindersJob.php - Laravel schedules
this dailyAt('09:00'); run the equivalent here via a daily cron entry (see
RUNNING.md's cron sidecar note). Creates Notification rows directly (not via
apps.communication.services.send_notification) to match the source job,
which bypasses per-user notification preferences for these reminders."""

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.communication.models import Notification
from apps.people.models import EmployeeDocument

REMINDER_DAYS = {90, 60, 30, 7}


class Command(BaseCommand):
    help = "Recompute employee document expiry status and send reminders at 90/60/30/7 days out."

    def handle(self, *args, **options):
        today = timezone.localdate()
        rows = EmployeeDocument.objects.filter(expiry_date__isnull=False).values(
            "organization_id", "employee_id", "document_type", "expiry_date"
        )

        notified = 0
        for row in rows:
            days = (row["expiry_date"] - today).days
            status = "expired" if days < 0 else ("expiring_soon" if days <= 30 else "valid")
            EmployeeDocument.objects.filter(
                organization_id=row["organization_id"], employee_id=row["employee_id"], document_type=row["document_type"]
            ).update(status=status, updated_at=timezone.now())

            if days not in REMINDER_DAYS:
                continue

            user = User.objects.filter(employee_id=row["employee_id"]).first()
            if not user:
                continue

            Notification.objects.create(
                organization_id=row["organization_id"], user_id=user.id, channel="in_app",
                title="Document Expiry Reminder", body=f"{row['document_type']} expires in {days} days.",
                status="sent", sent_at=timezone.now(),
            )
            notified += 1

        self.stdout.write(self.style.SUCCESS(f"Checked {len(rows)} document(s), sent {notified} reminder(s)."))
