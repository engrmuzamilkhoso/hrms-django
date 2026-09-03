"""
DRF views for /api/v1/{salary-structures,salary-components,employee-compensations,
payroll-runs,tax-rules,tax-brackets,expense-reimbursements}* - ported from
Payroll\\{SalaryStructureController,SalaryComponentController,
EmployeeCompensationController,PayrollRunController,TaxRuleController,
TaxBracketController,ExpenseReimbursementController}.php.
"""

import logging

from django.http import HttpResponse
from django.shortcuts import get_object_or_404

from apps.communication.services import send_notification
from apps.core.audit import log_action
from apps.core.views import EnvelopeAPIView

from . import services
from .models import (
    EmployeeCompensation,
    ExpenseReimbursement,
    PayrollItem,
    PayrollRun,
    SalaryComponent,
    SalaryStructure,
    TaxBracket,
    TaxRule,
)
from .serializers import (
    EmployeeCompensationSerializer,
    ExpenseReimbursementSerializer,
    PayrollItemSerializer,
    PayrollRunSerializer,
    SalaryComponentSerializer,
    SalaryStructureSerializer,
    TaxBracketSerializer,
    TaxRuleSerializer,
)

logger = logging.getLogger(__name__)


class SalaryStructureListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = SalaryStructure.objects.order_by("-id")
        return self.paginated_ok(request, qs, SalaryStructureSerializer)

    def post(self, request):
        data = request.data
        s = SalaryStructure.objects.create(
            organization_id=request.user.organization_id,
            name=data.get("name"),
            is_default=data.get("is_default", False),
            effective_from=data.get("effective_from"),
        )
        return self.ok(SalaryStructureSerializer(s).data, "Salary structure created", 201)


class SalaryComponentListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = SalaryComponent.objects.order_by("-id")
        return self.paginated_ok(request, qs, SalaryComponentSerializer)

    def post(self, request):
        data = request.data
        c = SalaryComponent.objects.create(
            organization_id=request.user.organization_id,
            salary_structure_id=data.get("salary_structure_id"),
            component_name=data.get("component_name"),
            component_type=data.get("component_type"),
            tax_treatment=data.get("tax_treatment", "taxable"),
            calc_method=data.get("calc_method", "fixed"),
            formula=data.get("formula"),
            default_amount=data.get("default_amount"),
        )
        return self.ok(SalaryComponentSerializer(c).data, "Salary component created", 201)


class EmployeeCompensationListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = EmployeeCompensation.objects.order_by("-id")
        return self.paginated_ok(request, qs, EmployeeCompensationSerializer)

    def post(self, request):
        data = request.data
        c = EmployeeCompensation.objects.create(
            organization_id=request.user.organization_id,
            employee_id=data.get("employee_id"),
            salary_structure_id=data.get("salary_structure_id"),
            gross_monthly=data.get("gross_monthly"),
            currency=data.get("currency"),
            effective_from=data.get("effective_from"),
            effective_to=data.get("effective_to"),
        )
        return self.ok(EmployeeCompensationSerializer(c).data, "Employee compensation saved", 201)


class PayrollRunListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = PayrollRun.objects.order_by("-id")
        return self.paginated_ok(request, qs, PayrollRunSerializer)

    def post(self, request):
        data = request.data
        run = PayrollRun.objects.create(
            organization_id=request.user.organization_id,
            period_start=data.get("period_start"),
            period_end=data.get("period_end"),
            payroll_scope=data.get("payroll_scope", "organization"),
            office_id=data.get("office_id") or None,
            department_id=data.get("department_id") or None,
            status="draft",
        )
        return self.ok(PayrollRunSerializer(run).data, "Payroll run created", 201)


class PayrollRunCalculateAPIView(EnvelopeAPIView):
    def post(self, request, run_id):
        get_object_or_404(PayrollRun, pk=run_id)
        result = services.calculate_run(request.user.organization_id, run_id)
        return self.ok(result, "Payroll calculated")


class PayrollRunLockAPIView(EnvelopeAPIView):
    def post(self, request, run_id):
        run = get_object_or_404(PayrollRun, pk=run_id)
        run.status = "locked"
        run.locked_by_user_id = request.user.id
        run.save()
        return self.ok(PayrollRunSerializer(run).data, "Payroll run locked")


class PayrollRunApproveAPIView(EnvelopeAPIView):
    def post(self, request, run_id):
        from django.utils import timezone

        run = get_object_or_404(PayrollRun, pk=run_id)
        before = PayrollRunSerializer(run).data

        run.status = "approved"
        run.approved_by_user_id = request.user.id
        run.approved_at = timezone.now()
        run.save()

        if float(run.total_net) == 0.0:
            logger.warning("zero_net_salary_alert run=%s period=%s to %s", run.id, run.period_start, run.period_end)

        # AccountingIntegrationService.pushPayrollJournal - pushes to an
        # external, org-configured accounting webhook (see
        # apps.payroll.api_urls' accounting_integration route). Logged here
        # rather than making a real outbound call in this migration pass.
        logger.info("payroll_journal_push_queued organization_id=%s run_id=%s", request.user.organization_id, run.id)

        send_notification(
            request.user.organization_id, request.user.id, "Payroll Approved",
            "Payroll run has been approved and accounting push has been queued.", ["in_app", "email"],
        )
        log_action(request, "payroll_run_approve", "payroll_run", run.id, before=before, after=PayrollRunSerializer(run).data)

        return self.ok(PayrollRunSerializer(run).data, "Payroll run approved and accounting journal queued")


class PayrollRunAdjustItemAPIView(EnvelopeAPIView):
    def patch(self, request, run_id, item_id):
        item = get_object_or_404(PayrollItem, pk=item_id)
        if item.payroll_run_id != run_id:
            return self.error("Payroll item does not belong to run.", 422)

        amount = request.data.get("amount")
        note = request.data.get("note")
        if amount is None or not note or not str(note).strip():
            return self.error(
                "The given data was invalid.", 422,
                errors={"note": ["Editing payroll entries requires a reason note."]},
            )

        before = PayrollItemSerializer(item).data
        item.amount = amount
        item.note = note
        item.save()
        log_action(request, "data_edit", "payroll_item", item.id, before=before, after=PayrollItemSerializer(item).data)

        return self.ok(PayrollItemSerializer(item).data, "Payroll item adjusted")


class PayrollRunBankExportAPIView(EnvelopeAPIView):
    def get(self, request, run_id):
        rows = PayrollItem.objects.filter(payroll_run_id=run_id, component_name="Net")
        csv_lines = ["employee_id,amount,remarks"]
        for row in rows:
            csv_lines.append(f"{row.employee_id},{row.amount},Salary Transfer")
        response = HttpResponse("\n".join(csv_lines) + "\n", content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="bank-export-run-{run_id}.csv"'
        return response


class PayslipAPIView(EnvelopeAPIView):
    def get(self, request, run_id, employee_id):
        items = PayrollItem.objects.filter(payroll_run_id=run_id, employee_id=employee_id).values(
            "component_name", "amount"
        )
        content = f"Simple Payslip\nPassword: 123\nRun: {run_id}\nEmployee: {employee_id}\n"
        for item in items:
            content += f"{item['component_name']}: {item['amount']}\n"
        response = HttpResponse(content, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="payslip-run-{run_id}-emp-{employee_id}.pdf"'
        response["X-Payslip-Password"] = "123"
        return response


class TaxRuleListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = TaxRule.objects.prefetch_related("brackets").order_by("-id")
        return self.paginated_ok(request, qs, TaxRuleSerializer)

    def post(self, request):
        data = request.data
        rule = TaxRule.objects.create(
            organization_id=request.user.organization_id,
            country_code=data.get("country_code"),
            rule_name=data.get("rule_name"),
            effective_from=data.get("effective_from"),
            effective_to=data.get("effective_to"),
            metadata_json=data.get("metadata_json"),
        )
        for b in data.get("brackets", []) or []:
            TaxBracket.objects.create(
                tax_rule=rule, range_min=b["range_min"], range_max=b.get("range_max"),
                percentage_rate=b["percentage_rate"], fixed_amount=b.get("fixed_amount", 0),
            )
        return self.ok(TaxRuleSerializer(rule).data, "Tax rule saved", 201)


class TaxBracketListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = TaxBracket.objects.filter(tax_rule__organization_id=request.user.organization_id)
        tax_rule_id = request.query_params.get("tax_rule_id")
        if tax_rule_id:
            qs = qs.filter(tax_rule_id=tax_rule_id)
        return self.ok(TaxBracketSerializer(qs.order_by("range_min"), many=True).data)

    def post(self, request):
        data = request.data
        rule = get_object_or_404(TaxRule, pk=data["tax_rule_id"], organization_id=request.user.organization_id)
        bracket = TaxBracket.objects.create(
            tax_rule=rule, range_min=data["range_min"], range_max=data.get("range_max"),
            percentage_rate=data["percentage_rate"], fixed_amount=data.get("fixed_amount", 0),
        )
        return self.ok(TaxBracketSerializer(bracket).data, "Tax bracket created", 201)


class TaxBracketDetailAPIView(EnvelopeAPIView):
    def put(self, request, bracket_id):
        bracket = get_object_or_404(TaxBracket, pk=bracket_id)
        if bracket.tax_rule.organization_id != request.user.organization_id:
            return self.error("Forbidden", 403)
        for field in ["range_min", "range_max", "percentage_rate", "fixed_amount"]:
            if field in request.data:
                setattr(bracket, field, request.data[field])
        bracket.save()
        return self.ok(TaxBracketSerializer(bracket).data, "Tax bracket updated")

    def delete(self, request, bracket_id):
        bracket = get_object_or_404(TaxBracket, pk=bracket_id)
        if bracket.tax_rule.organization_id != request.user.organization_id:
            return self.error("Forbidden", 403)
        bracket.delete()
        return self.ok(None, "Tax bracket deleted")


class ExpenseReimbursementListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = ExpenseReimbursement.objects.select_related("employee").filter(
            organization_id=request.user.organization_id
        ).order_by("-created_at")
        status_ = request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)
        employee_id = request.query_params.get("employee_id")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return self.paginated_ok(request, qs, ExpenseReimbursementSerializer, "Expense reimbursements retrieved")

    def post(self, request):
        data = request.data
        expense = ExpenseReimbursement.objects.create(
            organization_id=request.user.organization_id,
            employee_id=data["employee_id"],
            description=data["description"],
            category=data.get("category", "other"),
            amount=data["amount"],
            currency=data.get("currency", "PKR"),
            expense_date=data["expense_date"],
            receipt_url=data.get("receipt_url"),
            status="pending",
        )
        return self.ok(ExpenseReimbursementSerializer(expense).data, "Expense submitted", 201)


class ExpenseReimbursementApproveAPIView(EnvelopeAPIView):
    def post(self, request, expense_id):
        expense = get_object_or_404(
            ExpenseReimbursement, pk=expense_id, organization_id=request.user.organization_id
        )
        expense.status = "approved"
        expense.approved_by_user_id = request.user.id
        expense.save()
        return self.ok(ExpenseReimbursementSerializer(expense).data, "Expense approved")


class ExpenseReimbursementRejectAPIView(EnvelopeAPIView):
    def post(self, request, expense_id):
        expense = get_object_or_404(
            ExpenseReimbursement, pk=expense_id, organization_id=request.user.organization_id
        )
        expense.status = "rejected"
        expense.rejection_reason = request.data.get("rejection_reason")
        expense.save()
        return self.ok(None, "Expense rejected")


class ExpenseReimbursementIncludeInPayrollAPIView(EnvelopeAPIView):
    def post(self, request):
        data = request.data
        ExpenseReimbursement.objects.filter(
            organization_id=request.user.organization_id, id__in=data["ids"], status="approved"
        ).update(status="included_in_payroll", payroll_run_id=data["payroll_run_id"])
        return self.ok(None, "Expenses included in payroll run")
