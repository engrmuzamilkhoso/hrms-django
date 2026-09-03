"""Port of App\\Jobs\\SendProbationRemindersJob.php - Laravel schedules this
dailyAt('09:15'). Notifies every HR Manager in an employee's organization
when that employee's probation ends in exactly 30 days."""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.communication.models import Notification
from apps.people.models import Employee


class Command(BaseCommand):
    help = "Notify HR Managers 30 days ahead of an employee's probation end date."

    def handle(self, *args, **options):
        target = timezone.localdate() + timedelta(days=30)
        employees = Employee.objects.filter(probation_end_date=target)

        notified = 0
        for emp in employees:
            hr_users = User.objects.filter(organization_id=emp.organization_id, roles__name="HR Manager")
            for hr in hr_users:
                Notification.objects.create(
                    organization_id=emp.organization_id, user_id=hr.id, channel="in_app",
                    title="Probation Reminder", body=f"Probation ending in 30 days for {emp.full_name}.",
                    status="sent", sent_at=timezone.now(),
                )
                notified += 1

        self.stdout.write(self.style.SUCCESS(f"Checked {employees.count()} employee(s), sent {notified} reminder(s)."))
