"""
DRF views for /api/v1/reports/* - ported from
Reports\\{DashboardController,HeadcountReportController,
AttritionReportController,PayrollRegisterController}.php. No models of its
own - pure read/aggregation over Employee/AttendanceRecord/LeaveRequest/etc.
"""

from datetime import date, timedelta

from django.db.models import Count, F, Q, Sum
from django.utils import timezone

from apps.attendance.models import AttendanceRecord
from apps.core.views import EnvelopeAPIView
from apps.leave.models import LeaveCarryForward, LeavePolicy, LeaveRequest, LeaveType
from apps.payroll.models import PayrollItem, PayrollRun
from apps.payroll.serializers import PayrollRunSerializer
from apps.people.models import Employee


class OrgDashboardAPIView(EnvelopeAPIView):
    def get(self, request):
        org_id = request.user.organization_id
        today = timezone.localdate()

        total_active = Employee.objects.filter(organization_id=org_id, employment_status="active").count()
        present_today = AttendanceRecord.objects.filter(
            organization_id=org_id, attendance_date=today, clock_in__isnull=False
        ).count()
        on_leave_today = LeaveRequest.objects.filter(
            organization_id=org_id, status="approved", from_date__lte=today, to_date__gte=today
        ).count()
        pending_leaves = LeaveRequest.objects.filter(organization_id=org_id, status="pending").count()

        from apps.payroll.models import ExpenseReimbursement
        from apps.people.models import ProbationReview

        pending_expenses = ExpenseReimbursement.objects.filter(organization_id=org_id, status="pending").count()
        pending_probations = ProbationReview.objects.filter(
            organization_id=org_id, status="pending", probation_end_date__lte=today + timedelta(days=7)
        ).count()

        employees_with_dob = Employee.objects.filter(
            organization_id=org_id, employment_status="active", dob__isnull=False
        ).values("id", "full_name", "dob", "designation_text", "employee_code")

        upcoming_birthdays = []
        for emp in employees_with_dob:
            dob = emp["dob"]
            this_year_bday = dob.replace(year=today.year)
            if this_year_bday < today:
                this_year_bday = this_year_bday.replace(year=today.year + 1)
            days_away = (this_year_bday - today).days
            if days_away <= 14:
                upcoming_birthdays.append(
                    {
                        "id": emp["id"], "name": emp["full_name"], "designation": emp["designation_text"],
                        "employee_code": emp["employee_code"], "birthday_date": this_year_bday.isoformat(),
                        "days_away": days_away,
                    }
                )
        upcoming_birthdays.sort(key=lambda b: b["days_away"])

        recent_hires = list(
            Employee.objects.filter(organization_id=org_id, hire_date__gte=today - timedelta(days=30))
            .order_by("-hire_date")[:8]
            .values("id", "full_name", "designation_text", "employee_code", "hire_date")
        )
        for h in recent_hires:
            h["name"] = h.pop("full_name")
            h["designation"] = h.pop("designation_text")

        new_joiners_this_month = Employee.objects.filter(
            organization_id=org_id, hire_date__month=today.month, hire_date__year=today.year
        ).count()
        exits_this_month = Employee.objects.filter(
            organization_id=org_id, exit_date__month=today.month, exit_date__year=today.year
        ).count()

        by_department = [
            {"department": row["dept_name"], "count": row["count"]}
            for row in (
                Employee.objects.filter(
                    organization_id=org_id, employment_status="active", department__isnull=False
                )
                .values(dept_name=F("department__name"))
                .annotate(count=Count("id"))
                .order_by("-count")[:8]
            )
        ]

        return self.ok(
            {
                "totalActive": total_active, "presentToday": present_today, "onLeaveToday": on_leave_today,
                "pendingLeaves": pending_leaves, "pendingExpenses": pending_expenses,
                "pendingProbations": pending_probations, "newJoinersThisMonth": new_joiners_this_month,
                "exitsThisMonth": exits_this_month, "upcomingBirthdays": upcoming_birthdays,
                "recentHires": recent_hires, "byDepartment": by_department,
            }
        )


class ManagerDashboardAPIView(EnvelopeAPIView):
    def get(self, request):
        org_id = request.user.organization_id
        today = timezone.localdate()

        manager_employee = Employee.objects.filter(organization_id=org_id, email=request.user.email).first()
        if not manager_employee:
            return self.ok(
                {
                    "team_size": 0, "present_today": 0, "on_leave_today": 0,
                    "pending_leave_requests": 0, "team_members": [], "pending_leaves": [], "team_birthdays": [],
                }
            )

        team_members = list(
            Employee.objects.filter(
                organization_id=org_id, reporting_manager_id=manager_employee.id, employment_status="active"
            ).values("id", "full_name", "designation_text", "employee_code", "dob")
        )
        team_ids = [m["id"] for m in team_members]

        present_today = AttendanceRecord.objects.filter(
            organization_id=org_id, attendance_date=today, employee_id__in=team_ids, clock_in__isnull=False
        ).count()
        on_leave_today = LeaveRequest.objects.filter(
            organization_id=org_id, status="approved", from_date__lte=today, to_date__gte=today,
            employee_id__in=team_ids,
        ).count()

        pending_leaves_qs = list(
            LeaveRequest.objects.filter(organization_id=org_id, status="pending", employee_id__in=team_ids)
            .select_related("employee")
            .order_by("-created_at")[:10]
        )
        pending_leaves = [
            {
                "id": lr.id, "employee_id": lr.employee_id, "leave_type_id": lr.leave_type_id,
                "from_date": lr.from_date, "to_date": lr.to_date, "status": lr.status,
                "employee_name": lr.employee.full_name, "designation": lr.employee.designation_text,
            }
            for lr in pending_leaves_qs
        ]

        team_birthdays = [
            {"id": m["id"], "name": m["full_name"], "designation": m["designation_text"], "dob": m["dob"]}
            for m in team_members
            if m["dob"] and m["dob"].month == today.month
        ]

        return self.ok(
            {
                "team_size": len(team_members),
                "present_today": present_today,
                "on_leave_today": on_leave_today,
                "absent_today": max(0, len(team_members) - present_today - on_leave_today),
                "pending_leave_requests": len(pending_leaves),
                "team_members": [
                    {"id": m["id"], "name": m["full_name"], "designation": m["designation_text"], "employee_code": m["employee_code"]}
                    for m in team_members
                ],
                "pending_leaves": pending_leaves,
                "team_birthdays": team_birthdays,
            }
        )


class EmployeeDashboardAPIView(EnvelopeAPIView):
    def get(self, request):
        org_id = request.user.organization_id
        today = timezone.localdate()
        user = request.user

        employee = Employee.objects.filter(organization_id=org_id).filter(
            Q(user_id=user.id) | Q(email=user.email)
        ).first()
        if not employee:
            return self.ok({"error": "No employee record linked to your account."})

        today_attendance = AttendanceRecord.objects.filter(
            organization_id=org_id, employee_id=employee.id, attendance_date=today
        ).values().first()

        month_agg = AttendanceRecord.objects.filter(
            organization_id=org_id, employee_id=employee.id, attendance_date__month=today.month,
            attendance_date__year=today.year,
        ).aggregate(
            total_days=Count("id"), present_days=Count("id", filter=Q(clock_in__isnull=False))
        )

        leave_policy = LeavePolicy.objects.filter(pk=employee.leave_policy_id).first() if employee.leave_policy_id else None
        is_pro_rata = bool(leave_policy and leave_policy.pro_rata)

        leave_types = list(
            LeaveType.objects.filter(organization_id=org_id).values(
                "id", "name", "annual_quota", "negative_balance_allowed", "category"
            )
        )

        used_by_type = dict(
            LeaveRequest.objects.filter(
                organization_id=org_id, employee_id=employee.id, status="approved", from_date__year=today.year,
            ).values("leave_type_id").annotate(total_used=Sum("requested_days")).values_list(
                "leave_type_id", "total_used"
            )
        )

        pro_rata_fraction = 1.0
        if is_pro_rata and employee.hire_date:
            hire_date = employee.hire_date
            year_start = date(today.year, 1, 1)
            start_date = hire_date if hire_date.year == today.year else year_start
            months_remaining = (date(today.year, 12, 31).year - start_date.year) * 12 + (
                date(today.year, 12, 31).month - start_date.month
            ) + 1
            pro_rata_fraction = min(1.0, round(months_remaining / 12, 4))

        carry_forward_by_category = {}
        if employee.leave_policy_id:
            carry_forward_by_category = dict(
                LeaveCarryForward.objects.filter(
                    to_policy_id=employee.leave_policy_id, employee_id=employee.id
                ).values_list("leave_type_category", "carried_forward_days")
            )

        leave_balances = []
        for lt in leave_types:
            allocated = round(float(lt["annual_quota"]) * pro_rata_fraction, 1)
            carry_bonus = float(carry_forward_by_category.get(lt["category"] or "", 0) or 0)
            opening = allocated + carry_bonus
            used = float(used_by_type.get(lt["id"], 0) or 0)
            leave_balances.append(
                {
                    "leave_type_id": lt["id"], "name": lt["name"], "allocated_days": allocated,
                    "carry_forward_days": carry_bonus, "opening_balance": opening, "used_days": used,
                    "remaining_days": opening - used,
                }
            )

        my_leaves = list(
            LeaveRequest.objects.filter(
                organization_id=org_id, employee_id=employee.id, from_date__gte=today, status="approved",
            ).select_related("leave_type").order_by("from_date")[:5]
        )
        upcoming_leaves = [
            {"start_date": lr.from_date, "end_date": lr.to_date, "status": lr.status, "leave_type": lr.leave_type.name}
            for lr in my_leaves
        ]

        pending_leaves_qs = list(
            LeaveRequest.objects.filter(organization_id=org_id, employee_id=employee.id, status="pending")
            .select_related("leave_type").order_by("-created_at")[:5]
        )
        pending_leaves = [
            {
                "start_date": lr.from_date, "end_date": lr.to_date, "status": lr.status,
                "leave_type": lr.leave_type.name, "created_at": lr.created_at,
            }
            for lr in pending_leaves_qs
        ]

        recent_payslips = list(
            PayrollItem.objects.filter(organization_id=org_id, employee_id=employee.id)
            .select_related("payroll_run").order_by("-payroll_run__period_start")[:3]
            .values("payroll_run__period_start", "payroll_run__period_end", "payroll_run__status", "payroll_run_id")
            .distinct()
        )

        return self.ok(
            {
                "employee": {
                    "id": employee.id, "name": employee.full_name, "designation": employee.designation_text,
                    "employee_code": employee.employee_code, "hire_date": employee.hire_date, "dob": employee.dob,
                },
                "today_attendance": today_attendance,
                "month_summary": month_agg,
                "leave_balances": leave_balances,
                "upcoming_leaves": upcoming_leaves,
                "pending_leaves": pending_leaves,
                "recent_payslips": list(recent_payslips),
            }
        )


class HeadcountReportAPIView(EnvelopeAPIView):
    def get(self, request):
        today = timezone.localdate()
        active = Employee.objects.filter(employment_status="active").count()
        joined_this_month = Employee.objects.filter(hire_date__month=today.month, hire_date__year=today.year).count()
        exits_this_month = Employee.objects.filter(exit_date__month=today.month, exit_date__year=today.year).count()
        return self.ok({"active": active, "joinedThisMonth": joined_this_month, "exitsThisMonth": exits_this_month})


class AttritionReportAPIView(EnvelopeAPIView):
    def get(self, request):
        year = timezone.localdate().year
        exits = Employee.objects.filter(exit_date__year=year).count()
        avg_headcount = max(1, Employee.objects.count())
        attrition_rate = round((exits / avg_headcount) * 100, 2)
        return self.ok({"year": year, "exits": exits, "avgHeadcount": avg_headcount, "attritionRate": attrition_rate})


class PayrollRegisterAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = PayrollRun.objects.order_by("-id")
        return self.paginated_ok(request, qs, PayrollRunSerializer)
