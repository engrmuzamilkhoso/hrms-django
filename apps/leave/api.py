"""
DRF views for /api/v1/{leave-requests,leave-types,leave-policies,holidays}* -
ported from Leave\\{LeaveRequestController,LeaveTypeController,
LeavePolicyController,HolidayController}.php.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.core.views import EnvelopeAPIView

from . import services
from .models import Holiday, LeavePolicy, LeaveRequest, LeaveType
from .serializers import HolidaySerializer, LeavePolicySerializer, LeaveRequestSerializer, LeaveTypeSerializer


# ---------------------------------------------------------------------------
# Leave requests + approval engine
# ---------------------------------------------------------------------------
class LeaveRequestListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = LeaveRequest.objects.select_related("leave_type", "employee").order_by("-id")
        status_ = request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)
        employee_id = request.query_params.get("employee_id")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return self.paginated_ok(request, qs, LeaveRequestSerializer, default_per_page=30)

    @transaction.atomic
    def post(self, request):
        user = request.user
        data = request.data

        employee_id = data.get("employee_id")
        if not employee_id:
            emp = services.resolve_employee(user)
            if not emp:
                return self.error("No employee record found for your account.", 422)
            employee_id = emp.id

        duration_type = data.get("duration_type", "full_day")
        from datetime import date as date_cls

        from_date = date_cls.fromisoformat(data["from_date"])
        to_date = date_cls.fromisoformat(data["to_date"])

        days = services.calculate_days(user.organization_id, from_date, to_date, duration_type)

        leave_type = LeaveType.objects.filter(pk=data["leave_type_id"]).first()
        if leave_type and leave_type.affects_balance and leave_type.category != "self_managed":
            from django.db.models import Sum

            from apps.people.models import Employee

            used = (
                LeaveRequest.objects.filter(
                    employee_id=employee_id, leave_type_id=leave_type.id, status="approved",
                    from_date__year=timezone.localdate().year,
                ).aggregate(s=Sum("requested_days"))["s"]
                or 0
            )

            emp_record = Employee.objects.filter(pk=employee_id).first()
            carry_bonus = 0
            if emp_record and emp_record.leave_policy_id:
                from .models import LeaveCarryForward

                carry_bonus = (
                    LeaveCarryForward.objects.filter(
                        to_policy_id=emp_record.leave_policy_id, employee_id=emp_record.id,
                        leave_type_category=leave_type.category,
                    ).aggregate(s=Sum("carried_forward_days"))["s"]
                    or 0
                )

            remaining = float(leave_type.annual_quota) + float(carry_bonus) - float(used)
            if not leave_type.negative_balance_allowed and days > remaining:
                return self.error(
                    f"Insufficient balance. You have {remaining} day(s) remaining for {leave_type.name}.", 422
                )

        record = LeaveRequest.objects.create(
            organization_id=user.organization_id,
            employee_id=employee_id,
            leave_type_id=data["leave_type_id"],
            from_date=from_date,
            to_date=to_date,
            duration_type=duration_type,
            requested_days=days,
            status="pending",
            current_approval_level=1,
            reason=data.get("reason"),
            applied_by_user_id=user.id,
        )
        services.seed_approval_chain(record, user)

        record = LeaveRequest.objects.select_related("leave_type").get(pk=record.pk)
        return self.ok(LeaveRequestSerializer(record).data, "Leave request submitted", 201)


class MyLeaveRequestsAPIView(EnvelopeAPIView):
    def get(self, request):
        emp = services.resolve_employee(request.user)
        if not emp:
            return self.ok([])
        qs = LeaveRequest.objects.select_related("leave_type").filter(employee_id=emp.id).order_by("-id")
        return self.ok(LeaveRequestSerializer(qs, many=True).data)


class PendingApprovalAPIView(EnvelopeAPIView):
    def get(self, request):
        user = request.user
        org_id = user.organization_id
        admin = services.is_admin(user)
        emp = services.resolve_employee(user)
        my_emp_id = emp.id if emp else 0

        if admin:
            qs = LeaveRequest.objects.select_related("leave_type", "employee").filter(organization_id=org_id).order_by("-id")
            if emp:
                qs = qs.exclude(employee_id=emp.id)
            requests = list(qs)
        else:
            requests = list(services.get_manager_requests(org_id, my_emp_id))

        from .models import LeaveApproval

        request_ids = [r.id for r in requests]
        all_approvals = list(LeaveApproval.objects.filter(leave_request_id__in=request_ids).order_by("level_no"))
        by_request = {}
        for a in all_approvals:
            by_request.setdefault(a.leave_request_id, []).append(a)

        name_lookup = services.build_name_lookup(all_approvals)

        results = []
        for req in requests:
            rows = by_request.get(req.id, [])
            steps = services.build_steps(rows, name_lookup)

            role_status = req.status
            if req.status == "pending":
                if admin:
                    hr_step = next((s for s in steps if s["level"] == 2), None)
                    if hr_step and hr_step["status"] == "approved":
                        role_status = "approved"
                    elif hr_step and hr_step["status"] == "rejected":
                        role_status = "rejected"
                    else:
                        role_status = "pending"
                else:
                    my_step = next((a for a in rows if a.approver_employee_id == my_emp_id), None)
                    if my_step and my_step.status == "approved":
                        role_status = "approved"
                    elif my_step and my_step.status == "rejected":
                        role_status = "rejected"
                    else:
                        role_status = "pending"

            can_act = False
            has_pending = any(s["status"] == "pending" for s in steps)
            if has_pending and req.status == "pending":
                if admin:
                    can_act = True
                else:
                    my_row = next((a for a in rows if a.approver_employee_id == my_emp_id), None)
                    can_act = bool(my_row and my_row.status == "pending" and my_row.level_no <= req.current_approval_level)

            data = LeaveRequestSerializer(req).data
            data["status"] = role_status
            data["approval_steps"] = steps
            data["can_act"] = can_act
            results.append(data)

        return self.ok(results)


class ApprovalChainAPIView(EnvelopeAPIView):
    def get(self, request):
        user = request.user
        emp = services.resolve_employee(user)
        hr = services.find_admin_employee(user.organization_id)

        line_manager = None
        if emp and emp.reporting_manager_id:
            mgr = emp.reporting_manager
            if mgr:
                line_manager = {
                    "id": mgr.id, "full_name": mgr.full_name, "employee_code": mgr.employee_code,
                    "designation": mgr.designation_text,
                }

        hr_manager = None
        if hr:
            hr_manager = {
                "id": hr.id, "full_name": hr.full_name, "employee_code": hr.employee_code,
                "designation": hr.designation_text,
            }

        return self.ok({"line_manager": line_manager, "hr_manager": hr_manager})


class LeaveRequestDetailAPIView(EnvelopeAPIView):
    def get(self, request, leave_request_id):
        lr = get_object_or_404(LeaveRequest.objects.select_related("leave_type", "employee"), pk=leave_request_id)
        return self.ok(LeaveRequestSerializer(lr).data)

    def put(self, request, leave_request_id):
        lr = get_object_or_404(LeaveRequest, pk=leave_request_id)
        for field in ["reason", "status"]:
            if field in request.data:
                setattr(lr, field, request.data[field])
        lr.save()
        return self.ok(LeaveRequestSerializer(lr).data, "Leave request updated")

    def delete(self, request, leave_request_id):
        lr = get_object_or_404(LeaveRequest, pk=leave_request_id)
        if lr.status != "pending":
            return self.error("Only pending leave requests can be deleted.", 422)
        from .models import LeaveApproval

        LeaveApproval.objects.filter(leave_request_id=lr.id).delete()
        lr.delete()
        return self.ok(None, "Leave request deleted")


class LeaveRequestApproveAPIView(EnvelopeAPIView):
    @transaction.atomic
    def post(self, request, leave_request_id):
        lr = get_object_or_404(LeaveRequest, pk=leave_request_id)
        user = request.user
        emp = services.resolve_employee(user)
        emp_id = emp.id if emp else 0
        admin = services.is_admin(user)

        from .models import LeaveApproval

        approval = services.find_pending_approval(lr.id, emp_id, admin)

        if not approval and admin:
            LeaveApproval.objects.filter(leave_request_id=lr.id, status="pending").update(
                status="approved", acted_by_user_id=user.id, acted_at=timezone.now()
            )
            services.sync_status_from_chain(lr, user)
            lr = LeaveRequest.objects.select_related("leave_type", "employee").get(pk=lr.pk)
            return self.ok(LeaveRequestSerializer(lr).data, "Leave request approved")

        if not approval:
            return self.error("No pending approval steps remaining.", 422)

        approval.status = "approved"
        approval.acted_by_user_id = user.id
        approval.acted_at = timezone.now()
        approval.save()

        services.sync_status_from_chain(lr, user)
        lr = LeaveRequest.objects.select_related("leave_type", "employee").get(pk=lr.pk)
        message = "Leave request fully approved" if lr.status == "approved" else "Leave step approved — pending next level"
        return self.ok(LeaveRequestSerializer(lr).data, message)


class LeaveRequestRejectAPIView(EnvelopeAPIView):
    @transaction.atomic
    def post(self, request, leave_request_id):
        lr = get_object_or_404(LeaveRequest, pk=leave_request_id)
        rejection_reason = request.data.get("rejection_reason")
        if not rejection_reason:
            return self.error("The given data was invalid.", 422, errors={"rejection_reason": ["This field is required."]})

        user = request.user
        emp = services.resolve_employee(user)
        emp_id = emp.id if emp else 0
        admin = services.is_admin(user)

        approval = services.find_pending_approval(lr.id, emp_id, admin)
        if approval:
            approval.status = "rejected"
            approval.note = rejection_reason
            approval.acted_by_user_id = user.id
            approval.acted_at = timezone.now()
            approval.save()

        lr.status = "rejected"
        lr.rejection_reason = rejection_reason
        lr.approved_by_user_id = user.id
        lr.approved_at = timezone.now()
        lr.save()

        lr = LeaveRequest.objects.select_related("leave_type", "employee").get(pk=lr.pk)
        return self.ok(LeaveRequestSerializer(lr).data, "Leave request rejected")


class LeaveRequestDelegateAPIView(EnvelopeAPIView):
    def post(self, request, leave_request_id):
        lr = get_object_or_404(LeaveRequest, pk=leave_request_id)
        delegated_to_user_id = request.data.get("delegated_to_user_id")
        lr.delegated_to_user_id = delegated_to_user_id
        lr.status = "delegated"
        lr.save()

        from apps.accounts.models import User

        from .models import LeaveApproval

        delegated_user = User.objects.filter(pk=delegated_to_user_id).first()
        if delegated_user and delegated_user.employee_id:
            LeaveApproval.objects.create(
                organization_id=request.user.organization_id,
                leave_request=lr,
                approver_employee_id=delegated_user.employee_id,
                level_no=lr.current_approval_level,
                status="pending",
            )
        return self.ok(LeaveRequestSerializer(lr).data, "Leave request delegated")


# ---------------------------------------------------------------------------
# Leave types / balances
# ---------------------------------------------------------------------------
class LeaveTypeListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = LeaveType.objects.order_by("-id")
        return self.paginated_ok(request, qs, LeaveTypeSerializer)

    def post(self, request):
        data = dict(request.data)
        data["organization_id"] = request.user.organization_id
        lt = LeaveType.objects.create(
            organization_id=request.user.organization_id,
            name=data.get("name"),
            category=data.get("category"),
            affects_balance=data.get("affects_balance", True),
            policy_id=data.get("leave_policy_id"),
            annual_quota=data.get("annual_quota", 0),
            carry_forward_enabled=data.get("carry_forward_enabled", False),
            carry_forward_max=data.get("carry_forward_max"),
            carry_reset_date=data.get("carry_reset_date"),
            encashable=data.get("encashable", False),
            negative_balance_allowed=data.get("negative_balance_allowed", False),
            auto_approve_threshold_days=data.get("auto_approve_threshold_days"),
        )
        return self.ok(LeaveTypeSerializer(lt).data, "Leave type created", 201)


class LeaveTypeDetailAPIView(EnvelopeAPIView):
    def get(self, request, leave_type_id):
        lt = get_object_or_404(LeaveType, pk=leave_type_id)
        return self.ok(LeaveTypeSerializer(lt).data)

    def patch(self, request, leave_type_id):
        lt = get_object_or_404(LeaveType, pk=leave_type_id)
        for field in [
            "name", "category", "affects_balance", "annual_quota", "carry_forward_enabled",
            "carry_forward_max", "carry_reset_date", "encashable", "negative_balance_allowed",
            "auto_approve_threshold_days",
        ]:
            if field in request.data:
                setattr(lt, field, request.data[field])
        if "leave_policy_id" in request.data:
            lt.policy_id = request.data["leave_policy_id"]
        lt.save()
        return self.ok(LeaveTypeSerializer(lt).data, "Leave type updated")

    def delete(self, request, leave_type_id):
        lt = get_object_or_404(LeaveType, pk=leave_type_id)
        lt.delete()
        return self.ok(None, "Leave type deleted")


class LeaveTypeBalancesAPIView(EnvelopeAPIView):
    def get(self, request):
        from django.db.models import Sum

        from apps.people.models import Employee

        org_id = request.user.organization_id
        employee_id = int(request.query_params.get("employee_id", 0) or 0)
        year = int(request.query_params.get("year") or timezone.localdate().year)

        employee = Employee.objects.filter(pk=employee_id).first()
        types = LeaveType.objects.filter(organization_id=org_id).select_related("policy").order_by("name")

        balances = []
        for t in types:
            quota = float(t.annual_quota)
            allocated = _calc_allocated(quota, t.policy, employee, year)

            used = float(
                LeaveRequest.objects.filter(
                    employee_id=employee.id if employee else None, leave_type_id=t.id, status="approved",
                    from_date__year=year,
                ).aggregate(s=Sum("requested_days"))["s"]
                or 0
            )
            pending = float(
                LeaveRequest.objects.filter(
                    employee_id=employee.id if employee else None, leave_type_id=t.id, status="pending",
                    from_date__year=year,
                ).aggregate(s=Sum("requested_days"))["s"]
                or 0
            )
            remaining = max(0, allocated - used)

            balances.append(
                {
                    "leave_type_id": t.id, "name": t.name, "category": t.category,
                    "annual_quota": quota, "allocated": allocated, "used": used, "pending": pending,
                    "remaining": remaining, "carry_forward_enabled": t.carry_forward_enabled,
                    "encashable": t.encashable, "negative_balance_allowed": t.negative_balance_allowed,
                }
            )
        return self.ok(balances)


def _calc_allocated(quota, policy, employee, year):
    if not (policy and policy.pro_rata) or not (employee and employee.hire_date):
        return quota
    hire_date = employee.hire_date
    if hire_date.year > year:
        return 0
    if hire_date.year < year:
        return quota
    from datetime import date as date_cls

    total_days = (date_cls(year, 12, 31) - date_cls(year, 1, 1)).days + 1
    remaining_days = (date_cls(year, 12, 31) - hire_date).days + 1
    return round(quota * remaining_days / total_days, 1)


# ---------------------------------------------------------------------------
# Holidays
# ---------------------------------------------------------------------------
class HolidayListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = Holiday.objects.filter(organization_id=request.user.organization_id)
        year = request.query_params.get("year")
        if year:
            qs = qs.filter(holiday_date__year=year)
        office_id = request.query_params.get("office_id")
        if office_id:
            from django.db.models import Q

            qs = qs.filter(Q(office_id__isnull=True) | Q(office_id=office_id))
        return self.ok(HolidaySerializer(qs.order_by("holiday_date"), many=True).data)

    def post(self, request):
        data = request.data
        holiday = Holiday.objects.create(
            organization_id=request.user.organization_id,
            name=data.get("name"),
            holiday_date=data.get("holiday_date"),
            holiday_type=data.get("holiday_type"),
            office_id=data.get("office_id") or None,
            is_recurring=data.get("is_recurring", False),
        )
        return self.ok(HolidaySerializer(holiday).data, "Holiday created", 201)


class HolidayDetailAPIView(EnvelopeAPIView):
    def patch(self, request, holiday_id):
        holiday = get_object_or_404(Holiday, pk=holiday_id)
        if request.user.organization_id != holiday.organization_id:
            return self.error("Forbidden", 403)
        for field in ["name", "holiday_date", "holiday_type", "office_id", "is_recurring"]:
            if field in request.data:
                setattr(holiday, field, request.data[field])
        holiday.save()
        return self.ok(HolidaySerializer(holiday).data, "Holiday updated")

    def delete(self, request, holiday_id):
        holiday = get_object_or_404(Holiday, pk=holiday_id)
        if request.user.organization_id != holiday.organization_id:
            return self.error("Forbidden", 403)
        holiday.delete()
        return self.ok(None, "Holiday deleted")


# ---------------------------------------------------------------------------
# Leave policies (basic CRUD; renew/carry-forward-preview land with the
# cross-cutting jobs pass)
# ---------------------------------------------------------------------------
class LeavePolicyListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = (
            LeavePolicy.objects.filter(organization_id=request.user.organization_id)
            .prefetch_related("leave_types")
            .order_by("-start_date", "name")
        )
        return self.ok(LeavePolicySerializer(qs, many=True).data)

    def post(self, request):
        data = request.data
        org_id = request.user.organization_id
        if data.get("is_default"):
            LeavePolicy.objects.filter(organization_id=org_id).update(is_default=False)
        policy = LeavePolicy.objects.create(
            organization_id=org_id,
            name=data.get("name"),
            description=data.get("description"),
            is_default=data.get("is_default", False),
            pro_rata=data.get("pro_rata", False),
            start_date=data.get("start_date") or None,
            end_date=data.get("end_date") or None,
            previous_policy_id=data.get("previous_policy_id") or None,
            status="active",
        )
        return self.ok(LeavePolicySerializer(policy).data, "Leave policy created", 201)


class LeaveReportBalancesAPIView(EnvelopeAPIView):
    """Ported from Leave\\LeaveReportController.php (namespaced under Leave
    in Laravel despite being report-shaped; kept here to match)."""

    def get(self, request):
        from django.db.models import Sum

        from apps.organization.models import Department
        from apps.people.models import Employee

        org_id = request.user.organization_id
        year = int(request.query_params.get("year") or timezone.localdate().year)

        employees = list(
            Employee.objects.filter(organization_id=org_id, employment_status="active").order_by("full_name")
        )
        emp_ids = [e.id for e in employees]
        dept_names = dict(Department.objects.filter(organization_id=org_id).values_list("id", "name"))

        policy_ids = {e.leave_policy_id for e in employees if e.leave_policy_id}
        policies = {p.id: p for p in LeavePolicy.objects.filter(id__in=policy_ids)}
        types_by_policy = {}
        for t in LeaveType.objects.filter(policy_id__in=policy_ids):
            types_by_policy.setdefault(t.policy_id, []).append(t)

        approved_rows = (
            LeaveRequest.objects.filter(organization_id=org_id, status="approved", from_date__year=year, employee_id__in=emp_ids)
            .values("employee_id", "leave_type_id")
            .annotate(total=Sum("requested_days"))
        )
        pending_rows = (
            LeaveRequest.objects.filter(organization_id=org_id, status="pending", from_date__year=year, employee_id__in=emp_ids)
            .values("employee_id", "leave_type_id")
            .annotate(total=Sum("requested_days"))
        )
        approved = {}
        for r in approved_rows:
            approved.setdefault(r["employee_id"], {})[r["leave_type_id"]] = float(r["total"] or 0)
        pending = {}
        for r in pending_rows:
            pending.setdefault(r["employee_id"], {})[r["leave_type_id"]] = float(r["total"] or 0)

        report = []
        for emp in employees:
            policy = policies.get(emp.leave_policy_id)
            types = types_by_policy.get(emp.leave_policy_id, [])
            emp_approved = approved.get(emp.id, {})
            emp_pending = pending.get(emp.id, {})

            balances = []
            for t in types:
                quota = float(t.annual_quota)
                allocated = _calc_allocated(quota, policy, emp, year)
                used = emp_approved.get(t.id, 0.0)
                pend = emp_pending.get(t.id, 0.0)
                balances.append(
                    {
                        "leave_type_id": t.id, "name": t.name, "category": t.category,
                        "allocated": allocated, "used": used, "pending": pend,
                        "remaining": max(0, allocated - used),
                    }
                )

            report.append(
                {
                    "employee_id": emp.id, "full_name": emp.full_name, "employee_code": emp.employee_code,
                    "department": dept_names.get(emp.department_id), "policy_name": policy.name if policy else None,
                    "balances": balances,
                }
            )

        return self.ok(report, "Leave balance report")


class LeavePolicyDetailAPIView(EnvelopeAPIView):
    def patch(self, request, policy_id):
        policy = get_object_or_404(LeavePolicy, pk=policy_id)
        if request.data.get("is_default"):
            LeavePolicy.objects.filter(organization_id=policy.organization_id).exclude(pk=policy.id).update(is_default=False)
        for field in ["name", "description", "is_default", "pro_rata", "start_date", "end_date", "status"]:
            if field in request.data:
                setattr(policy, field, request.data[field])
        policy.save()
        return self.ok(LeavePolicySerializer(policy).data, "Leave policy updated")

    def delete(self, request, policy_id):
        policy = get_object_or_404(LeavePolicy, pk=policy_id)
        policy.delete()
        return self.ok(None, "Leave policy deleted")


def _used_days(org_id, employee_id, leave_type_id, policy):
    qs = LeaveRequest.objects.filter(
        organization_id=org_id, employee_id=employee_id, leave_type_id=leave_type_id, status="approved"
    )
    if policy.start_date and policy.end_date:
        qs = qs.filter(from_date__range=(policy.start_date, policy.end_date))
    else:
        qs = qs.filter(from_date__year=timezone.localdate().year)
    from django.db.models import Sum

    return float(qs.aggregate(total=Sum("requested_days"))["total"] or 0)


def _carry_forward_preview_rows(org_id, policy):
    from apps.people.models import Employee

    employees = Employee.objects.filter(organization_id=org_id, leave_policy_id=policy.id)
    carry_types = policy.leave_types.filter(carry_forward_enabled=True)
    if not carry_types.exists() or not employees.exists():
        return []

    preview = []
    for emp in employees:
        balances = []
        for lt in carry_types:
            used = _used_days(org_id, emp.id, lt.id, policy)
            allocated = float(lt.annual_quota)
            remaining = max(0, allocated - used)
            carry_max = float(lt.carry_forward_max) if lt.carry_forward_max else remaining
            carry_days = min(remaining, carry_max)
            if carry_days > 0:
                balances.append(
                    {
                        "category": lt.category, "name": lt.name, "allocated": allocated, "used": used,
                        "remaining": remaining, "carry_forward_days": carry_days,
                        "carry_forward_max": float(lt.carry_forward_max) if lt.carry_forward_max else None,
                    }
                )
        if balances:
            preview.append({"employee_id": emp.id, "full_name": emp.full_name, "employee_code": emp.employee_code, "balances": balances})
    return preview


class LeavePolicyCarryForwardPreviewAPIView(EnvelopeAPIView):
    def get(self, request, policy_id):
        policy = get_object_or_404(LeavePolicy, pk=policy_id, organization_id=request.user.organization_id)
        return self.ok(_carry_forward_preview_rows(request.user.organization_id, policy))


class LeavePolicyRenewAPIView(EnvelopeAPIView):
    @transaction.atomic
    def post(self, request, policy_id):
        from apps.people.models import Employee

        old_policy = get_object_or_404(LeavePolicy, pk=policy_id, organization_id=request.user.organization_id)
        data = request.data
        name = data.get("name")
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        if not name or not start_date or not end_date:
            return self.error(
                "The given data was invalid.", 422,
                errors={"name": ["required"], "start_date": ["required"], "end_date": ["required"]},
            )

        org_id = request.user.organization_id
        user = request.user

        new_policy = LeavePolicy.objects.create(
            organization_id=org_id, name=name, description=old_policy.description,
            is_default=old_policy.is_default, pro_rata=old_policy.pro_rata,
            start_date=start_date, end_date=end_date, previous_policy_id=old_policy.id, status="active",
        )

        for lt in old_policy.leave_types.all():
            LeaveType.objects.create(
                organization_id=org_id, policy=new_policy, name=lt.name, category=lt.category,
                affects_balance=lt.affects_balance, annual_quota=lt.annual_quota,
                carry_forward_enabled=lt.carry_forward_enabled, carry_forward_max=lt.carry_forward_max,
                carry_reset_date=lt.carry_reset_date, encashable=lt.encashable,
                negative_balance_allowed=lt.negative_balance_allowed,
                auto_approve_threshold_days=lt.auto_approve_threshold_days,
            )

        carry_forward_count = 0
        if data.get("carry_forward"):
            from .models import LeaveCarryForward

            preview = _carry_forward_preview_rows(org_id, old_policy)
            for row in preview:
                for b in row["balances"]:
                    _, created = LeaveCarryForward.objects.get_or_create(
                        organization_id=org_id, employee_id=row["employee_id"], from_policy=old_policy,
                        to_policy=new_policy, leave_type_category=b["category"] or "annual",
                        defaults=dict(
                            remaining_days=b["remaining"], carried_forward_days=b["carry_forward_days"],
                            processed_at=timezone.now(), processed_by_user_id=user.id,
                        ),
                    )
                    if created:
                        carry_forward_count += 1

        assigned_count = 0
        if data.get("auto_assign"):
            assigned_count = Employee.objects.filter(organization_id=org_id, leave_policy_id=old_policy.id).update(
                leave_policy_id=new_policy.id
            )

        if old_policy.end_date and old_policy.end_date < timezone.localdate():
            old_policy.status = "expired"
            old_policy.save()

        new_policy.refresh_from_db()
        return self.ok(
            {
                "policy": LeavePolicySerializer(new_policy).data,
                "carry_forward_count": carry_forward_count,
                "assigned_employees": assigned_count,
            },
            "Policy renewed successfully", 201,
        )
