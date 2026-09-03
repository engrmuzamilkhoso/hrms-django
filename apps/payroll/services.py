"""Direct port of app/Services/PayrollEngineService.php."""

from datetime import timedelta

from django.db.models import Sum

from .models import EmployeeCompensation, PayrollItem, PayrollRun, TaxRule


def _weekdays_inclusive(start, end):
    days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:
            days += 1
        current += timedelta(days=1)
    return days


def calculate_tax(organization_id, gross):
    rule = TaxRule.objects.filter(organization_id=organization_id).order_by("-effective_from").first()
    if not rule:
        return 0.0
    for bracket in rule.brackets.all():
        min_ = float(bracket.range_min)
        max_ = float(bracket.range_max) if bracket.range_max is not None else float("inf")
        if min_ <= gross <= max_:
            tax = float(bracket.fixed_amount) + (gross - min_) * (float(bracket.percentage_rate) / 100)
            return max(0, tax)
    return 0.0


def calculate_run(organization_id, payroll_run_id):
    from apps.attendance.models import AttendanceRecord, AttendanceRule, Shift
    from apps.leave.models import LeaveRequest
    from apps.people.models import Employee

    run = PayrollRun.objects.get(pk=payroll_run_id)
    PayrollItem.objects.filter(payroll_run_id=run.id).delete()

    period_start, period_end = run.period_start, run.period_end
    working_days = max(1, _weekdays_inclusive(period_start, period_end))

    comps = EmployeeCompensation.objects.filter(effective_from__lte=period_end).exclude(
        effective_to__lt=period_start
    )

    total_gross = total_deductions = total_net = 0.0

    for comp in comps:
        employee = Employee.objects.filter(pk=comp.employee_id).first()
        shift = Shift.objects.filter(pk=employee.shift_id).first() if employee and employee.shift_id else None

        attendance_days = AttendanceRecord.objects.filter(
            employee_id=comp.employee_id, attendance_date__gte=period_start, attendance_date__lte=period_end
        ).count()

        approved_leaves = float(
            LeaveRequest.objects.filter(
                employee_id=comp.employee_id, status="approved",
                from_date__gte=period_start, from_date__lte=period_end,
            ).aggregate(s=Sum("requested_days"))["s"]
            or 0
        )

        payable_days = min(working_days, attendance_days + approved_leaves)
        absence_days = max(0, working_days - payable_days)
        daily_gross = float(comp.gross_monthly) / working_days
        absence_deduction = daily_gross * absence_days

        overtime_after_minutes = int((float(shift.overtime_after_hours) if shift and shift.overtime_after_hours else 8) * 60)
        # Mirrors Laravel's SUM(GREATEST(work_minutes - threshold, 0))
        records = AttendanceRecord.objects.filter(
            employee_id=comp.employee_id, attendance_date__gte=period_start, attendance_date__lte=period_end
        ).values_list("work_minutes", flat=True)
        overtime_minutes = sum(max((m or 0) - overtime_after_minutes, 0) for m in records)
        overtime_hours = overtime_minutes / 60
        ot_multiplier = float(shift.overtime_multiplier) if shift and shift.overtime_multiplier else 1.5
        overtime_pay = overtime_hours * (daily_gross / 8) * ot_multiplier

        night_diff_pay = 0.0
        if shift and shift.night_diff_multiplier and float(shift.night_diff_multiplier) > 0:
            is_overnight_shift = shift.start_time > shift.end_time
            if is_overnight_shift:
                night_minutes = sum(m or 0 for m in records)
                night_hours = night_minutes / 60
                night_diff_pay = night_hours * (daily_gross / 8) * (float(shift.night_diff_multiplier) - 1)

        late_deduction = 0.0
        late_days = AttendanceRecord.objects.filter(
            employee_id=comp.employee_id, attendance_date__gte=period_start, attendance_date__lte=period_end,
            is_late=True,
        ).count()
        rule = AttendanceRule.objects.filter(office_id=employee.office_id).first() if employee and employee.office_id else None
        if rule and rule.late_deduction_after_n_days and late_days >= rule.late_deduction_after_n_days:
            late_deduction = daily_gross

        tax = calculate_tax(organization_id, float(comp.gross_monthly))
        gross = float(comp.gross_monthly) + overtime_pay + night_diff_pay
        deductions = absence_deduction + late_deduction + tax
        net = max(0, gross - deductions)

        items = [
            ("Gross", "earning", gross),
            ("Overtime", "earning", overtime_pay),
            ("Night Differential", "earning", night_diff_pay),
            ("Absence Deduction", "deduction", absence_deduction),
            ("Late Deduction", "deduction", late_deduction),
            ("Tax", "deduction", tax),
            ("Net", "net", net),
        ]
        for name, type_, amount in items:
            PayrollItem.objects.create(
                organization_id=organization_id, payroll_run_id=run.id, employee_id=comp.employee_id,
                component_name=name, component_type=type_, amount=amount,
            )

        total_gross += gross
        total_deductions += deductions
        total_net += net

    run.total_gross = total_gross
    run.total_deductions = total_deductions
    run.total_net = total_net
    run.save()

    return {
        "payroll_run_id": payroll_run_id,
        "organization_id": organization_id,
        "totals": {"gross": total_gross, "deductions": total_deductions, "net": total_net},
        "status": "calculated",
    }
