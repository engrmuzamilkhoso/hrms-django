"""Ported from app/Services/ExitSettlementService.php."""

from django.db.models import Sum

from apps.organization.models import OrganizationSetting
from apps.payroll.models import EmployeeCompensation, EmployeeLoan

from .models import ExitSettlement


def calculate_settlement(organization_id, workflow, notice_required_days=0, notice_served_days=0):
    comp = (
        EmployeeCompensation.objects.filter(employee_id=workflow.employee_id).order_by("-effective_from").first()
    )
    gross = float(comp.gross_monthly) if comp else 0.0
    daily = gross / 30

    notice_short = max(0, notice_required_days - notice_served_days)
    short_notice_recovery = daily * notice_short

    service_years = 0
    employee = workflow.employee
    if employee and employee.hire_date and workflow.exit_date:
        service_years = (workflow.exit_date - employee.hire_date).days // 365
    gratuity = daily * 21 * service_years

    loan_recovery = float(
        EmployeeLoan.objects.filter(employee_id=workflow.employee_id, status="active").aggregate(
            s=Sum("remaining_balance")
        )["s"]
        or 0
    )

    leave_encashment = daily * 5
    outstanding_salary = daily * 15
    net = outstanding_salary + leave_encashment + gratuity - loan_recovery - short_notice_recovery

    settlement, _ = ExitSettlement.objects.update_or_create(
        organization_id=organization_id, exit_workflow_id=workflow.id, employee_id=workflow.employee_id,
        defaults=dict(
            outstanding_salary=round(outstanding_salary, 2),
            leave_encashment=round(leave_encashment, 2),
            gratuity_amount=round(gratuity, 2),
            loan_recovery=round(loan_recovery + short_notice_recovery, 2),
            net_settlement=round(net, 2),
            status="calculated",
        ),
    )
    return settlement


def assert_clearance_rules(organization_id, clearance_statuses, override_reason, force_finalize):
    setting = OrganizationSetting.objects.filter(organization_id=organization_id).first()
    mode = setting.exit_clearance_mode if setting else "strict"
    all_done = all(s == "completed" for s in clearance_statuses)

    if all_done:
        return None
    if mode == "force_allowed" and force_finalize:
        return None
    if not override_reason or not override_reason.strip():
        return "All clearance tasks must be completed or override reason is mandatory."
    return None
