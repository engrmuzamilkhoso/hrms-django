"""Port of App\\Jobs\\GenerateMonthlyBillingJob.php - Laravel schedules this
monthlyOn(28, '23:00'), calling BillingController::generate(now()->format('Y-m'))
for the current month. Shares apps.platform_admin.services.generate_billing
with BillingGenerateAPIView (the manual super-admin trigger) rather than
duplicating the invoice-generation logic."""

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.platform_admin.services import generate_billing


class Command(BaseCommand):
    help = "Generate this month's billing records for every organization (run on the 28th, matching the source app's schedule)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--period", default=None,
            help="Billing period as YYYY-MM. Defaults to the current month, matching the scheduled job.",
        )

    def handle(self, *args, **options):
        period = options["period"] or timezone.localdate().strftime("%Y-%m")
        records = generate_billing(period)
        self.stdout.write(self.style.SUCCESS(f"Generated {len(records)} invoice(s) for period {period}."))
