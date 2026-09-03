"""
DRF views for /api/v1/{organizations/me,offices,departments,teams}* -
ported from Organization\\{OrganizationController,OfficeController,
DepartmentController,TeamController}.php.

Note: OfficeController::store() in the source app references fields that
don't exist on the offices table (country, radius_meters,
working_hours_start/end, phone, email - not in Office::$fillable) and never
sets the actual NOT NULL country_code column, so creating an office there
is dead-on-arrival (a DB error). Implemented here against the real schema
instead (country_code, attendance_radius_m, ...) - see plan's "fix only
dead code" carve-out.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from apps.core.permissions import HasRole
from apps.core.views import EnvelopeAPIView

from .models import Department, Office, Organization, OrganizationSetting, Team
from .serializers import DepartmentSerializer, OfficeSerializer, OrganizationSerializer, TeamSerializer

ADMIN_OR_HR = HasRole.of(["Org Admin", "HR Manager"])


def _check_org_access(request, resource_org_id):
    if request.user.organization_id != resource_org_id:
        raise PermissionDenied("Unauthorized access")


class OrganizationMeAPIView(EnvelopeAPIView):
    def get(self, request):
        org = get_object_or_404(Organization, pk=request.user.organization_id)
        return self.ok(OrganizationSerializer(org).data)

    def patch(self, request):
        org = get_object_or_404(Organization, pk=request.user.organization_id)
        data = request.data
        for field in ["name", "timezone", "default_language", "date_format"]:
            if field in data:
                setattr(org, field, data[field])
        org.save()

        if "hr_mode" in data or "exit_clearance_mode" in data:
            OrganizationSetting.objects.update_or_create(
                organization=org,
                defaults={
                    "hr_mode": data.get("hr_mode", "global"),
                    "exit_clearance_mode": data.get("exit_clearance_mode", "strict"),
                },
            )
        return self.ok(OrganizationSerializer(org).data, "Organization updated")


class OfficeListCreateAPIView(EnvelopeAPIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [ADMIN_OR_HR()]
        return super().get_permissions()

    def get(self, request):
        queryset = Office.objects.filter(organization_id=request.user.organization_id).order_by("name")
        search = request.query_params.get("search")
        if search:
            from django.db.models import Q

            queryset = queryset.filter(Q(name__icontains=search) | Q(city__icontains=search))
        return self.paginated_ok(request, queryset, OfficeSerializer, "Offices retrieved")

    def post(self, request):
        data = request.data
        office = Office.objects.create(
            organization_id=request.user.organization_id,
            name=data.get("name"),
            country_code=data.get("country_code"),
            city=data.get("city"),
            address=data.get("address"),
            latitude=data.get("latitude") or None,
            longitude=data.get("longitude") or None,
            attendance_radius_m=data.get("attendance_radius_m") or 100,
            timezone=data.get("timezone", "UTC"),
            is_default=data.get("is_default", False),
            wfh_monthly_cap=data.get("wfh_monthly_cap") or None,
        )
        return self.ok(OfficeSerializer(office).data, "Office created successfully", 201)


class OfficeDetailAPIView(EnvelopeAPIView):
    def get_permissions(self):
        if self.request.method in ("PUT", "DELETE"):
            return [ADMIN_OR_HR()]
        return super().get_permissions()

    def get(self, request, office_id):
        office = get_object_or_404(Office, pk=office_id)
        _check_org_access(request, office.organization_id)
        return self.ok(OfficeSerializer(office).data, "Office retrieved")

    def put(self, request, office_id):
        office = get_object_or_404(Office, pk=office_id)
        _check_org_access(request, office.organization_id)
        for field in [
            "name", "country_code", "city", "address", "latitude", "longitude",
            "attendance_radius_m", "timezone", "is_default", "wfh_monthly_cap",
        ]:
            if field in request.data:
                setattr(office, field, request.data[field])
        office.save()
        return self.ok(OfficeSerializer(office).data, "Office updated successfully")

    def delete(self, request, office_id):
        office = get_object_or_404(Office, pk=office_id)
        _check_org_access(request, office.organization_id)
        office.delete()
        return self.ok(None, "Office deleted successfully")


class DepartmentListCreateAPIView(EnvelopeAPIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [ADMIN_OR_HR()]
        return super().get_permissions()

    def get(self, request):
        queryset = Department.objects.filter(organization_id=request.user.organization_id).order_by("name")
        office_id = request.query_params.get("office_id")
        if office_id:
            queryset = queryset.filter(office_id=office_id)
        search = request.query_params.get("search")
        if search:
            from django.db.models import Q

            queryset = queryset.filter(Q(name__icontains=search) | Q(code__icontains=search))
        return self.paginated_ok(request, queryset, DepartmentSerializer, "Departments retrieved")

    def post(self, request):
        data = request.data
        department = Department.objects.create(
            organization_id=request.user.organization_id,
            name=data.get("name"),
            code=data.get("code"),
            description=data.get("description"),
            parent_department_id=data.get("parent_department_id") or None,
            head_employee_id=data.get("head_employee_id") or None,
            budget=data.get("budget") or None,
            is_active=data.get("is_active", True),
        )
        return self.ok(DepartmentSerializer(department).data, "Department created successfully", 201)


class DepartmentDetailAPIView(EnvelopeAPIView):
    def get_permissions(self):
        if self.request.method in ("PUT", "DELETE"):
            return [ADMIN_OR_HR()]
        return super().get_permissions()

    def get(self, request, department_id):
        department = get_object_or_404(Department, pk=department_id)
        _check_org_access(request, department.organization_id)
        return self.ok(DepartmentSerializer(department).data, "Department retrieved")

    def put(self, request, department_id):
        department = get_object_or_404(Department, pk=department_id)
        _check_org_access(request, department.organization_id)
        for field in ["name", "code", "description", "parent_department_id", "head_employee_id", "budget", "is_active"]:
            if field in request.data:
                setattr(department, field, request.data[field])
        department.save()
        return self.ok(DepartmentSerializer(department).data, "Department updated successfully")

    def delete(self, request, department_id):
        department = get_object_or_404(Department, pk=department_id)
        _check_org_access(request, department.organization_id)
        if Department.objects.filter(parent_department_id=department.id).exists():
            return self.error("Cannot delete department with sub-departments", 400)
        department.delete()
        return self.ok(None, "Department deleted successfully")


class TeamListCreateAPIView(EnvelopeAPIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [ADMIN_OR_HR()]
        return super().get_permissions()

    def get(self, request):
        queryset = Team.objects.filter(organization_id=request.user.organization_id).order_by("name")
        department_id = request.query_params.get("department_id")
        if department_id:
            queryset = queryset.filter(department_id=department_id)
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)
        return self.paginated_ok(request, queryset, TeamSerializer, "Teams retrieved")

    def post(self, request):
        data = request.data
        team = Team.objects.create(
            organization_id=request.user.organization_id,
            name=data.get("name"),
            department_id=data.get("department_id"),
            lead_employee_id=data.get("lead_employee_id") or data.get("team_lead_id") or None,
        )
        return self.ok(TeamSerializer(team).data, "Team created successfully", 201)


class TeamDetailAPIView(EnvelopeAPIView):
    def get_permissions(self):
        if self.request.method in ("PUT", "DELETE"):
            return [ADMIN_OR_HR()]
        return super().get_permissions()

    def get(self, request, team_id):
        team = get_object_or_404(Team, pk=team_id)
        _check_org_access(request, team.organization_id)
        return self.ok(TeamSerializer(team).data, "Team retrieved")

    def put(self, request, team_id):
        team = get_object_or_404(Team, pk=team_id)
        _check_org_access(request, team.organization_id)
        for field in ["name", "department_id", "lead_employee_id"]:
            if field in request.data:
                setattr(team, field, request.data[field])
        team.save()
        return self.ok(TeamSerializer(team).data, "Team updated successfully")

    def delete(self, request, team_id):
        team = get_object_or_404(Team, pk=team_id)
        _check_org_access(request, team.organization_id)
        team.delete()
        return self.ok(None, "Team deleted successfully")
