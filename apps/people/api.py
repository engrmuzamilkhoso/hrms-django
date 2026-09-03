"""
DRF views for /api/v1/{employees,designations}* - ported 1:1 from
People\\{EmployeeController,DesignationController}.php.
"""

from django.db import transaction
from django.db.models import F
from django.forms.models import model_to_dict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.core.audit import log_action
from apps.core.permissions import HasRole
from apps.core.views import EnvelopeAPIView
from apps.payroll.models import EmployeeCompensation

from . import services
from .models import Designation, Employee
from .serializers import DesignationSerializer, EmployeeSerializer

ADMIN_OR_HR = HasRole.of(["Org Admin", "HR Manager"])


def _check_org_access(request, resource_org_id):
    if request.user.organization_id != resource_org_id:
        raise PermissionDenied("Unauthorized access")


class EmployeeListCreateAPIView(EnvelopeAPIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [ADMIN_OR_HR()]
        return super().get_permissions()

    def get(self, request):
        org_id = request.user.organization_id
        role_names = request.user.get_role_names()

        queryset = Employee.objects.filter(organization_id=org_id).order_by("full_name")

        if "Org Admin" in role_names or "HR Manager" in role_names:
            pass
        elif "Team Lead" in role_names:
            from django.db.models import Q

            manager_emp = Employee.objects.filter(organization_id=org_id).filter(
                Q(user_id=request.user.id) | Q(email=request.user.email)
            ).first()
            if manager_emp:
                queryset = queryset.filter(reporting_manager_id=manager_emp.id)
            else:
                queryset = queryset.none()

        search = request.query_params.get("search")
        if search:
            from django.db.models import Q

            queryset = queryset.filter(
                Q(full_name__icontains=search) | Q(email__icontains=search) | Q(employee_code__icontains=search)
            )

        queryset = queryset.select_related("office", "department", "team")
        return self.paginated_ok(request, queryset, EmployeeSerializer, "Employees retrieved")

    @transaction.atomic
    def post(self, request):
        org_id = request.user.organization_id
        data = request.data

        employee_code = services.generate_employee_code(org_id)

        designation_id = data.get("designation_id")
        designation = (
            Designation.objects.filter(organization_id=org_id, pk=designation_id).first()
            if designation_id
            else None
        )

        employee = Employee.objects.create(
            organization_id=org_id,
            employee_code=employee_code,
            full_name=data.get("full_name"),
            email=data.get("email"),
            phone=data.get("phone"),
            hire_date=data.get("hire_date"),
            office_id=data.get("office_id") or None,
            department_id=data.get("department_id") or None,
            team_id=data.get("team_id") or None,
            shift_id=data.get("shift_id") or None,
            leave_policy_id=data.get("leave_policy_id") or None,
            reporting_manager_id=data.get("reporting_manager_id") or None,
            current_designation=designation,
            designation_text=(designation.title if designation else data.get("designation")),
            employment_status=data.get("employment_status", "active"),
        )

        gross_monthly = data.get("gross_monthly")
        if gross_monthly is not None and float(gross_monthly) > 0:
            EmployeeCompensation.objects.create(
                organization_id=org_id,
                employee_id=employee.id,
                designation=designation,
                salary_structure=None,
                gross_monthly=gross_monthly,
                currency=data.get("currency", "PKR"),
                effective_from=employee.hire_date,
                effective_to=None,
            )

        services.sync_reporting_managers(org_id, employee.id, data.get("reporting_manager_ids", []) or [])

        employee = Employee.objects.select_related("office", "department", "team").get(pk=employee.pk)
        return self.ok(EmployeeSerializer(employee).data, "Employee created successfully", 201)


class EmployeeDetailAPIView(EnvelopeAPIView):
    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [ADMIN_OR_HR()]
        return super().get_permissions()

    def get(self, request, employee_id):
        employee = get_object_or_404(Employee, pk=employee_id)
        _check_org_access(request, employee.organization_id)
        employee = Employee.objects.select_related(
            "office", "department", "team", "current_designation", "reporting_manager"
        ).get(pk=employee.pk)
        return self.ok(EmployeeSerializer(employee).data, "Employee retrieved")

    def put(self, request, employee_id):
        employee = get_object_or_404(Employee, pk=employee_id)
        _check_org_access(request, employee.organization_id)

        before = model_to_dict(employee)
        data = request.data
        for field in [
            "full_name", "email", "phone", "dob", "gender", "marital_status", "nationality",
            "national_id_no", "passport_no", "contract_type", "hire_date", "probation_end_date",
            "employment_status", "office_id", "department_id", "team_id", "shift_id",
            "leave_policy_id", "reporting_manager_id", "designation_text",
        ]:
            payload_key = "designation" if field == "designation_text" else field
            if payload_key in data:
                setattr(employee, field, data.get(payload_key) or None)
        employee.save()

        if "reporting_manager_ids" in data:
            services.sync_reporting_managers(
                request.user.organization_id, employee.id, data.get("reporting_manager_ids", []) or []
            )

        log_action(
            request, "data_edit", "employee", employee.id,
            before=_json_safe(before), after=_json_safe(model_to_dict(employee)),
        )

        employee = Employee.objects.select_related("office", "department", "team").get(pk=employee.pk)
        return self.ok(EmployeeSerializer(employee).data, "Employee updated successfully")

    def delete(self, request, employee_id):
        employee = get_object_or_404(Employee, pk=employee_id)
        _check_org_access(request, employee.organization_id)
        employee.delete()
        return self.ok(None, "Employee deleted successfully")


def _json_safe(d):
    return {k: (str(v) if hasattr(v, "isoformat") or hasattr(v, "quantize") else v) for k, v in d.items()}


class DesignationListCreateAPIView(EnvelopeAPIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [ADMIN_OR_HR()]
        return super().get_permissions()

    def get(self, request):
        from django.db.models import Count

        designations = (
            Designation.objects.filter(organization_id=request.user.organization_id)
            .annotate(employees_count=Count("employees"))
            .order_by("title")
        )
        return self.ok(DesignationSerializer(designations, many=True).data, "Designations retrieved")

    def post(self, request):
        designation = Designation.objects.create(
            organization_id=request.user.organization_id,
            title=request.data.get("title"),
            grade=request.data.get("grade"),
            is_active=request.data.get("is_active", True),
        )
        return self.ok(DesignationSerializer(designation).data, "Designation created", 201)


class DesignationDetailAPIView(EnvelopeAPIView):
    permission_classes = [ADMIN_OR_HR]

    def put(self, request, designation_id):
        designation = get_object_or_404(Designation, pk=designation_id)
        _check_org_access(request, designation.organization_id)
        for field in ["title", "grade", "is_active"]:
            if field in request.data:
                setattr(designation, field, request.data.get(field))
        designation.save()
        return self.ok(DesignationSerializer(designation).data, "Designation updated")

    def delete(self, request, designation_id):
        designation = get_object_or_404(Designation, pk=designation_id)
        _check_org_access(request, designation.organization_id)
        designation.delete()
        return self.ok(None, "Designation deleted")


class DesignationAssignAPIView(EnvelopeAPIView):
    permission_classes = [ADMIN_OR_HR]

    @transaction.atomic
    def post(self, request):
        org_id = request.user.organization_id
        data = request.data
        designation = get_object_or_404(Designation, organization_id=org_id, pk=data.get("designation_id"))
        employee = get_object_or_404(Employee, organization_id=org_id, pk=data.get("employee_id"))

        effective_from = data.get("effective_from")
        gross_monthly = data.get("gross_monthly")
        currency = data.get("currency", "PKR")

        from datetime import date, timedelta

        effective_from_date = date.fromisoformat(effective_from)

        EmployeeCompensation.objects.filter(employee_id=employee.id, effective_to__isnull=True).update(
            effective_to=effective_from_date - timedelta(days=1), updated_at=timezone.now()
        )

        EmployeeCompensation.objects.create(
            organization_id=org_id,
            employee_id=employee.id,
            designation=designation,
            salary_structure=None,
            gross_monthly=gross_monthly,
            currency=currency,
            effective_from=effective_from_date,
            effective_to=None,
        )

        employee.current_designation = designation
        employee.designation_text = designation.title
        employee.save(update_fields=["current_designation", "designation_text", "updated_at"])

        employee = Employee.objects.select_related("office", "department", "team").get(pk=employee.pk)
        return self.ok(EmployeeSerializer(employee).data, "Designation assigned — promotion recorded")


class DesignationHistoryAPIView(EnvelopeAPIView):
    def get(self, request, employee_id):
        employee = get_object_or_404(Employee, pk=employee_id)
        _check_org_access(request, employee.organization_id)

        history = list(
            EmployeeCompensation.objects.filter(employee_id=employee.id)
            .select_related("designation")
            .order_by("-effective_from")
            .values(
                "id", "organization_id", "employee_id", "salary_structure_id", "designation_id",
                "gross_monthly", "currency", "effective_from", "effective_to", "created_at", "updated_at",
                designation_title=F("designation__title"),
                designation_grade=F("designation__grade"),
            )
        )
        return self.ok(history, "Designation history retrieved")
