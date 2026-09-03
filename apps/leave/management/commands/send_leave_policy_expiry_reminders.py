"""Port of App\\Jobs\\SendLeavePolicyExpiryRemindersJob.php - Laravel
schedules this dailyAt('09:30'). Marks past-end-date policies expired, then
notifies Org Admins/HR Managers at the 30/14/7/1-day marks (deduped by
checking whether an equivalent notification already exists)."""

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.communication.models import Notification
from apps.leave.models import LeavePolicy

REMINDER_DAYS_BEFORE = [30, 14, 7, 1]


class Command(BaseCommand):
    help = "Expire past-end-date leave policies and remind admins ahead of upcoming expiries."

    def handle(self, *args, **options):
        today = timezone.localdate()

        expired_count = LeavePolicy.objects.filter(end_date__isnull=False, end_date__lt=today).exclude(status="expired").update(status="expired")

        notified = 0
        for days_before in REMINDER_DAYS_BEFORE:
            target_date = today + timezone.timedelta(days=days_before)
            policies = LeavePolicy.objects.filter(end_date=target_date)

            for policy in policies:
                hr_users = User.objects.filter(organization_id=policy.organization_id, roles__name__in=["Org Admin", "HR Manager"])
                for hr in hr_users:
                    exists = (
                        Notification.objects.filter(user_id=hr.id, title="Leave Policy Expiring")
                        .filter(body__contains=policy.name)
                        .filter(body__contains=f"{days_before} day")
                        .exists()
                    )
                    if exists:
                        continue

                    Notification.objects.create(
                        organization_id=policy.organization_id, user_id=hr.id, channel="in_app",
                        title="Leave Policy Expiring",
                        body=(
                            f'Leave policy "{policy.name}" expires in {days_before} day(s) '
                            f"on {policy.end_date.strftime('%d %b %Y')}. Please renew it or create a new policy."
                        ),
                        status="sent", sent_at=timezone.now(),
                    )
                    notified += 1

        self.stdout.write(self.style.SUCCESS(f"Expired {expired_count} polic(ies), sent {notified} reminder(s)."))
