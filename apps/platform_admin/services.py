"""Shared billing-generation logic, used by both BillingGenerateAPIView (the
manual super-admin trigger) and the generate_monthly_billing management
command (the scheduled equivalent of Laravel's GenerateMonthlyBillingJob,
which itself just called BillingController::generate() - same
one-source-of-truth shape here)."""

from calendar import monthrange
from datetime import timedelta

from django.utils import timezone

from apps.organization.models import Organization
from apps.people.models import Employee

from .models import BillingRecord, PlanPricing


def generate_billing(period):
    """period: "YYYY-MM" string. Returns the list of BillingRecord rows
    created/updated for that period, one per organization."""
    prices = {p.plan_code: p for p in PlanPricing.objects.all()}
    year, month = (int(x) for x in period.split("-"))
    due_date = timezone.datetime(year, month, monthrange(year, month)[1]).date() + timedelta(days=30)

    generated = []
    for org in Organization.objects.all():
        plan_code = org.plan_code or "trial"
        plan = prices.get(plan_code)
        amount = float(org.custom_monthly_price or 0) if plan_code == "custom" else float(plan.monthly_price if plan else 0)
        active_count = Employee.all_objects.filter(organization_id=org.id, employment_status="active").count()
        invoice_num = f"INV-{period.replace('-', '')}-{org.id:04d}"

        record, _ = BillingRecord.objects.update_or_create(
            organization=org, billing_period=period,
            defaults=dict(
                invoice_number=invoice_num, plan_code=plan_code, active_employee_count=active_count,
                amount=amount, currency=org.default_currency or "USD", status="pending",
                generated_at=timezone.now(), due_date=due_date,
            ),
        )
        generated.append(record)

    return generated
