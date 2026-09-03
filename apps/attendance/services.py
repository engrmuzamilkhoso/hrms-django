"""Ported from app/Services/WfhPolicyService.php."""

from datetime import date

from .models import AttendanceRecord, WfhPolicy


def check_within_wfh_cap(organization_id, employee_id, is_override):
    """Returns None if OK, or an error message string mirroring Laravel's
    abort(422, 'WFH monthly cap exceeded. HR override is required.')."""

    from apps.people.models import Employee

    employee = Employee.objects.get(pk=employee_id)

    policy_qs = WfhPolicy.objects.filter(employee_id=employee_id)
    if employee.department_id:
        from django.db.models import Q

        policy_qs = WfhPolicy.objects.filter(Q(employee_id=employee_id) | Q(department_id=employee.department_id))
    policy = policy_qs.order_by("-employee_id").first()

    if not policy:
        return None

    today = date.today()
    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = today.replace(year=today.year + 1, month=1, day=1)
    else:
        month_end = today.replace(month=today.month + 1, day=1)

    used = AttendanceRecord.objects.filter(
        employee_id=employee_id, is_wfh=True, attendance_date__gte=month_start, attendance_date__lt=month_end
    ).count()

    if used >= policy.monthly_cap and not (is_override and policy.hr_override_allowed):
        return "WFH monthly cap exceeded. HR override is required."
    return None
