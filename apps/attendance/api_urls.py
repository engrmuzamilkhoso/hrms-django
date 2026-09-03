from django.urls import path

from . import api

urlpatterns = [
    path("attendance/clock-in", api.ClockInAPIView.as_view()),
    path("attendance/clock-out", api.ClockOutAPIView.as_view()),
    path("attendance/reports/monthly", api.MonthlyAttendanceAPIView.as_view()),
    path("attendance/rules/missing-punch-check", api.MissingPunchCheckAPIView.as_view()),
    path("attendance-rules", api.AttendanceRuleListAPIView.as_view()),
    path("shifts", api.ShiftListCreateAPIView.as_view()),
    path("shift-swaps", api.ShiftSwapRequestAPIView.as_view()),
    path("shift-swaps/<int:swap_id>/approve", api.ShiftSwapApproveAPIView.as_view()),
]
