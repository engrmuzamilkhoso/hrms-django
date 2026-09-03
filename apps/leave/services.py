"""
Ported from App\\Services\\LeaveCalculationService.php and the private
approval-engine helpers in Leave\\LeaveRequestController.php (seedApprovalChain,
findPendingApproval, syncStatusFromChain, isAdmin, resolveEmployee,
findAdminEmployee, getManagerRequests, buildSteps, buildNameLookup).
"""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from .models import Holiday, LeaveApproval, LeaveRequest


def calculate_days(organization_id, from_date, to_date, duration_type="full_day"):
    holiday_dates = set(
        Holiday.all_objects.filter(
            organization_id=organization_id, holiday_date__gte=from_date, holiday_date__lte=to_date
        ).values_list("holiday_date", flat=True)
    )

    days = 0.0
    current = from_date
    while current <= to_date:
        if current.weekday() < 5 and current not in holiday_dates:  # Mon-Fri, Python: 5=Sat,6=Sun
            days += 1.0
        current += timedelta(days=1)

    if duration_type == "half_day":
        return 0.5
    return days


def is_admin(user):
    if user.is_super_admin:
        return True
    roles = user.get_role_names()
    return "Org Admin" in roles or "HR Manager" in roles


def resolve_employee(user):
    from apps.people.models import Employee

    return Employee.objects.filter(organization_id=user.organization_id).filter(
        Q(user_id=user.id) | Q(email=user.email)
    ).first()


def find_admin_employee(organization_id):
    from apps.accounts.models import User
    from apps.people.models import Employee

    admin_user_ids = list(
        User.objects.filter(
            organization_id=organization_id, roles__name__in=["Org Admin", "HR Manager"]
        ).values_list("id", "employee_id", "email")
    )
    if not admin_user_ids:
        return None

    direct_ids = [eid for _uid, eid, _email in admin_user_ids if eid]
    if direct_ids:
        found = Employee.objects.filter(organization_id=organization_id, id__in=direct_ids).first()
        if found:
            return found

    user_ids = [uid for uid, _eid, _email in admin_user_ids]
    found = Employee.objects.filter(organization_id=organization_id, user_id__in=user_ids).first()
    if found:
        return found

    emails = [email for _uid, _eid, email in admin_user_ids]
    return Employee.objects.filter(organization_id=organization_id, email__in=emails).first()


def seed_approval_chain(leave_request, user):
    from apps.people.models import Employee

    org_id = user.organization_id
    emp = Employee.objects.filter(pk=leave_request.employee_id).first()

    if emp and emp.reporting_manager_id:
        LeaveApproval.objects.create(
            organization_id=org_id,
            leave_request=leave_request,
            approver_employee_id=emp.reporting_manager_id,
            level_no=1,
            status="pending",
        )

    hr_emp = find_admin_employee(org_id)
    if hr_emp:
        LeaveApproval.objects.create(
            organization_id=org_id,
            leave_request=leave_request,
            approver_employee_id=hr_emp.id,
            level_no=2,
            status="pending",
        )


def find_pending_approval(leave_request_id, emp_id, admin):
    if emp_id:
        own = (
            LeaveApproval.objects.filter(leave_request_id=leave_request_id, approver_employee_id=emp_id, status="pending")
            .order_by("level_no")
            .first()
        )
        if own:
            return own

    if admin:
        return (
            LeaveApproval.objects.filter(leave_request_id=leave_request_id, status="pending")
            .order_by("level_no")
            .first()
        )
    return None


def sync_status_from_chain(leave_request, user):
    steps = list(LeaveApproval.objects.filter(leave_request_id=leave_request.id))
    admin = is_admin(user)

    any_rejected = any(s.status == "rejected" for s in steps)
    any_pending = any(s.status == "pending" for s in steps)
    max_approved_lvl = max([s.level_no for s in steps if s.status == "approved"], default=0)

    has_level1 = any(s.level_no == 1 for s in steps)
    has_level2 = any(s.level_no == 2 for s in steps)
    both_levels_approved = has_level1 and has_level2 and not any_pending and not any_rejected
    admin_fully_approved = admin and not any_pending and not any_rejected and len(steps) > 0

    now = timezone.now()
    if any_rejected:
        leave_request.status = "rejected"
        leave_request.approved_by_user_id = user.id
        leave_request.approved_at = now
    elif both_levels_approved or admin_fully_approved:
        leave_request.status = "approved"
        leave_request.approved_by_user_id = user.id
        leave_request.approved_at = now
    else:
        leave_request.status = "pending"
        leave_request.current_approval_level = max_approved_lvl + 1
        leave_request.approved_by_user_id = None
        leave_request.approved_at = None
    leave_request.save()


def get_manager_requests(organization_id, emp_id):
    from apps.people.models import Employee

    if not emp_id:
        return LeaveRequest.objects.none()

    approval_ids = LeaveApproval.objects.filter(approver_employee_id=emp_id).values_list("leave_request_id", flat=True)
    direct_report_ids = Employee.objects.filter(organization_id=organization_id, reporting_manager_id=emp_id).values_list(
        "id", flat=True
    )
    direct_ids = LeaveRequest.objects.filter(employee_id__in=direct_report_ids).exclude(
        id__in=list(approval_ids)
    ).values_list("id", flat=True)

    all_ids = set(approval_ids) | set(direct_ids)
    return (
        LeaveRequest.objects.filter(id__in=all_ids)
        .select_related("leave_type", "employee")
        .order_by("-id")
    )


def build_steps(rows, name_lookup):
    steps = []
    for level, role in [(1, "Line Manager"), (2, "HR")]:
        row = next((r for r in rows if r.level_no == level), None)
        steps.append(
            {
                "level": level,
                "role": role,
                "status": row.status if row else "pending",
                "approver": name_lookup.get(row.id) if row else None,
            }
        )
    return steps


def build_name_lookup(approval_rows):
    from apps.accounts.models import User
    from apps.people.models import Employee

    if not approval_rows:
        return {}

    emp_ids = {r.approver_employee_id for r in approval_rows if r.approver_employee_id}
    user_ids = {r.acted_by_user_id for r in approval_rows if r.acted_by_user_id}

    emp_names = dict(Employee.objects.filter(id__in=emp_ids).values_list("id", "full_name")) if emp_ids else {}
    user_names = dict(User.objects.filter(id__in=user_ids).values_list("id", "name")) if user_ids else {}

    lookup = {}
    for a in approval_rows:
        if a.acted_by_user_id and a.acted_by_user_id in user_names:
            lookup[a.id] = user_names[a.acted_by_user_id]
        elif a.approver_employee_id in emp_names:
            lookup[a.id] = emp_names[a.approver_employee_id]
    return lookup
