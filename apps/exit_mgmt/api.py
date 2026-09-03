"""DRF views for /api/v1/exit-workflows* - ported from Exit\\ExitWorkflowController.php."""

from django.shortcuts import get_object_or_404

from apps.communication.services import send_notification
from apps.core.views import EnvelopeAPIView

from . import services
from .models import ExitClearanceTask, ExitWorkflow, OrgClearanceDepartment
from .serializers import ExitSettlementSerializer, ExitWorkflowSerializer

DEFAULT_CLEARANCE_DEPARTMENTS = ["IT", "Finance", "Admin", "HR", "Security"]


class ExitWorkflowListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = ExitWorkflow.objects.filter(employee__organization_id=request.user.organization_id).order_by("-id")
        return self.paginated_ok(request, qs, ExitWorkflowSerializer)

    def post(self, request):
        org_id = request.user.organization_id
        data = request.data

        workflow = ExitWorkflow.objects.create(
            employee_id=data["employee_id"],
            exit_type=data.get("exit_type"),
            exit_date=data.get("last_working_date"),
        )

        departments = list(OrgClearanceDepartment.objects.filter(organization_id=org_id))
        if not departments:
            OrgClearanceDepartment.objects.bulk_create(
                [
                    OrgClearanceDepartment(organization_id=org_id, department_name=name)
                    for name in DEFAULT_CLEARANCE_DEPARTMENTS
                ]
            )
            departments = list(OrgClearanceDepartment.objects.filter(organization_id=org_id))

        for dept in departments:
            ExitClearanceTask.objects.create(
                organization_id=org_id, exit_workflow_id=workflow.id, employee_id=workflow.employee_id,
                department_name=dept.department_name, status="pending",
            )
            if dept.responsible_user_id:
                send_notification(
                    org_id, dept.responsible_user_id, "Exit Clearance Task",
                    f"A new clearance task is assigned for department {dept.department_name}", ["in_app", "email"],
                )

        return self.ok(ExitWorkflowSerializer(workflow).data, "Exit workflow created", 201)


class ExitCalculateSettlementAPIView(EnvelopeAPIView):
    def post(self, request, workflow_id):
        workflow = get_object_or_404(ExitWorkflow.objects.select_related("employee"), pk=workflow_id)
        settlement = services.calculate_settlement(request.user.organization_id, workflow)
        return self.ok(ExitSettlementSerializer(settlement).data, "Exit settlement calculated")


class ExitFinalizeAPIView(EnvelopeAPIView):
    def post(self, request, workflow_id):
        workflow = get_object_or_404(ExitWorkflow.objects.select_related("employee"), pk=workflow_id)
        data = request.data

        error = services.assert_clearance_rules(
            request.user.organization_id, data["clearance_statuses"], data.get("override_reason"),
            bool(data.get("force_finalize", False)),
        )
        if error:
            return self.error(error, 422)

        settlement = services.calculate_settlement(request.user.organization_id, workflow)
        settlement.status = "finalized"
        settlement.override_reason = data.get("override_reason")
        settlement.save()
        return self.ok(ExitSettlementSerializer(settlement).data, "Exit settlement finalized")
