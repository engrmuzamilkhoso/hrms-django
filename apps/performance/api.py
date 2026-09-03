"""
DRF views for /api/v1/{performance-cycles,goals,promotions}* - ported from
Performance\\{PerformanceCycleController,GoalController,PromotionController}.php.
"""

from django.shortcuts import get_object_or_404

from apps.core.views import EnvelopeAPIView

from .models import Goal, PerformanceCycle, PromotionApproval
from .serializers import GoalSerializer, PerformanceCycleSerializer


class PerformanceCycleListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = PerformanceCycle.objects.order_by("-id")
        return self.paginated_ok(request, qs, PerformanceCycleSerializer)

    def post(self, request):
        data = request.data
        cycle = PerformanceCycle.objects.create(
            organization_id=request.user.organization_id,
            name=data["name"],
            cycle_type=data["cycle_type"],
            start_date=data["start_date"],
            end_date=data["end_date"],
        )
        return self.ok(PerformanceCycleSerializer(cycle).data, "Performance cycle created", 201)


class GoalListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = Goal.objects.order_by("-id")
        return self.paginated_ok(request, qs, GoalSerializer)

    def post(self, request):
        data = request.data
        goal = Goal.objects.create(
            employee_id=data["employee_id"],
            performance_cycle_id=data["performance_cycle_id"],
            organization_objective_id=data.get("organization_objective_id"),
            title=data["title"],
            description=data.get("description"),
            weightage=data.get("weightage") or 0,
            status="draft",
        )
        return self.ok(GoalSerializer(goal).data, "Goal created", 201)


class PromotionApproveAPIView(EnvelopeAPIView):
    def post(self, request, promotion_request_id):
        from apps.payroll.models import EmployeeCompensation
        from apps.people.models import Employee
        from apps.people.serializers import EmployeeSerializer

        data = request.data
        employee = get_object_or_404(Employee, pk=data["employee_id"])
        employee.designation_text = data["new_designation"]
        employee.save(update_fields=["designation_text", "updated_at"])

        if data.get("salary_structure_id"):
            EmployeeCompensation.objects.filter(employee_id=employee.id).update(
                salary_structure_id=data["salary_structure_id"]
            )

        PromotionApproval.objects.create(
            organization_id=request.user.organization_id,
            promotion_request_id=promotion_request_id,
            level_no=3,
            role_name="Senior Management",
            status="approved",
            acted_by_user_id=request.user.id,
            note="Final approval",
        )

        employee = Employee.objects.select_related("office", "department", "team").get(pk=employee.pk)
        return self.ok(EmployeeSerializer(employee).data, "Promotion approved and employee updated")
