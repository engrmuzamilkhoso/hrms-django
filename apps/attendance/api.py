"""
DRF views for /api/v1/{attendance,shifts,shift-swaps,attendance-rules}* -
ported from Attendance\\{AttendanceController,ShiftController,
ShiftSwapController,AttendanceRuleController}.php.
"""

from datetime import datetime, timedelta

from django.db import models
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.core.views import EnvelopeAPIView

from . import services
from .models import AttendanceRecord, AttendanceRule, Shift, ShiftSwapRequest
from .serializers import (
    AttendanceRecordSerializer,
    AttendanceRuleSerializer,
    ShiftSerializer,
    ShiftSwapRequestSerializer,
)


class ClockInAPIView(EnvelopeAPIView):
    def post(self, request):
        data = request.data
        is_wfh = bool(data.get("is_wfh", False))

        if is_wfh:
            error = services.check_within_wfh_cap(
                request.user.organization_id, int(data["employee_id"]), bool(data.get("hr_override", False))
            )
            if error:
                return self.error(error, 422)
        elif data.get("method") == "web_gps":
            if data.get("latitude") is None or data.get("longitude") is None:
                return self.error("GPS coordinates are required for non-WFH web clock-in.", 422)

        record, _ = AttendanceRecord.objects.update_or_create(
            employee_id=data["employee_id"],
            attendance_date=timezone.localdate(),
            defaults=dict(
                organization_id=request.user.organization_id,
                office_id=data.get("office_id") or None,
                method=data.get("method"),
                is_wfh=is_wfh,
                clock_in=timezone.now(),
            ),
        )
        return self.ok(AttendanceRecordSerializer(record).data, "Clock-in recorded")


class ClockOutAPIView(EnvelopeAPIView):
    def post(self, request):
        record = get_object_or_404(
            AttendanceRecord, employee_id=request.data["employee_id"], attendance_date=timezone.localdate()
        )
        record.clock_out = timezone.now()
        minutes = int((record.clock_out - record.clock_in).total_seconds() // 60) if record.clock_in else 0
        record.work_minutes = minutes

        rule = AttendanceRule.objects.filter(office_id=record.office_id).first()
        if rule:
            record.is_half_day = minutes < float(rule.min_hours_for_full_day) * 60
        record.save()
        return self.ok(AttendanceRecordSerializer(record).data, "Clock-out recorded")


class MonthlyAttendanceAPIView(EnvelopeAPIView):
    def get(self, request):
        month = request.query_params.get("month")
        year, mon = (int(x) for x in month.split("-"))

        records = AttendanceRecord.objects.filter(
            attendance_date__year=year, attendance_date__month=mon
        ).order_by("attendance_date")

        summary = {
            "wfh_days": records.filter(is_wfh=True).count(),
            "late_days": records.filter(is_late=True).count(),
            "half_days": records.filter(is_half_day=True).count(),
        }
        return self.ok({"records": AttendanceRecordSerializer(records, many=True).data, "summary": summary})


class MissingPunchCheckAPIView(EnvelopeAPIView):
    def post(self, request):
        from apps.accounts.models import User
        from apps.communication.services import send_notification

        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        records = AttendanceRecord.objects.filter(attendance_date=yesterday).filter(
            models.Q(clock_in__isnull=True) | models.Q(clock_out__isnull=True)
        )

        for rec in records:
            user = User.objects.filter(employee_id=rec.employee_id).first()
            if user:
                send_notification(
                    rec.organization_id, user.id, "Missing Punch Alert",
                    f"Attendance punch is missing for {yesterday}", ["in_app", "email"],
                )

        return self.ok({"checked": records.count()}, "Missing punch check complete")


class ShiftListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = Shift.objects.filter(organization_id=request.user.organization_id).order_by("-id")
        return self.paginated_ok(request, qs, ShiftSerializer)

    def post(self, request):
        data = request.data
        shift = Shift.objects.create(
            organization_id=request.user.organization_id,
            office_id=data.get("office_id") or None,
            name=data.get("name"),
            start_time=data.get("start_time"),
            end_time=data.get("end_time"),
            grace_minutes=data.get("grace_minutes") or 0,
            min_hours=data.get("min_hours") or None,
            overtime_after_hours=data.get("overtime_after_hours") or None,
            overtime_multiplier=data.get("overtime_multiplier") or None,
            night_diff_multiplier=data.get("night_diff_multiplier") or None,
        )
        return self.ok(ShiftSerializer(shift).data, "Shift created", 201)


class AttendanceRuleListAPIView(EnvelopeAPIView):
    def get(self, request):
        rules = AttendanceRule.objects.filter(organization_id=request.user.organization_id).order_by("-id")
        return self.ok(AttendanceRuleSerializer(rules, many=True).data)

    def post(self, request):
        data = request.data
        rule, _ = AttendanceRule.objects.update_or_create(
            organization_id=request.user.organization_id,
            office_id=data["office_id"],
            defaults=dict(
                grace_minutes=data.get("grace_minutes") or 0,
                min_hours_for_full_day=data.get("min_hours_for_full_day") or 8,
                missing_punch_alert=data.get("missing_punch_alert", True),
                late_deduction_after_n_days=data.get("late_deduction_after_n_days") or 0,
            ),
        )
        return self.ok(AttendanceRuleSerializer(rule).data, "Attendance rule saved")


class ShiftSwapRequestAPIView(EnvelopeAPIView):
    def post(self, request):
        data = request.data
        swap = ShiftSwapRequest.objects.create(
            organization_id=request.user.organization_id,
            from_employee_id=data["from_employee_id"],
            to_employee_id=data["to_employee_id"],
            swap_date=data["swap_date"],
            status="pending_hr",
        )
        return self.ok(ShiftSwapRequestSerializer(swap).data, "Shift swap requested", 201)


class ShiftSwapApproveAPIView(EnvelopeAPIView):
    def post(self, request, swap_id):
        swap = get_object_or_404(ShiftSwapRequest, pk=swap_id)
        swap.status = "approved"
        swap.approved_by_user_id = request.user.id
        swap.save()
        return self.ok(ShiftSwapRequestSerializer(swap).data, "Shift swap approved by HR")
