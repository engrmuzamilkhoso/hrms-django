from django.urls import path

from . import api

urlpatterns = [
    path("leave-types/balances", api.LeaveTypeBalancesAPIView.as_view()),
    path("leave-types", api.LeaveTypeListCreateAPIView.as_view()),
    path("leave-types/<int:leave_type_id>", api.LeaveTypeDetailAPIView.as_view()),
    path("leave-requests/my", api.MyLeaveRequestsAPIView.as_view()),
    path("leave-requests/pending-approval", api.PendingApprovalAPIView.as_view()),
    path("leave-requests/approval-chain", api.ApprovalChainAPIView.as_view()),
    path("leave-requests", api.LeaveRequestListCreateAPIView.as_view()),
    path("leave-requests/<int:leave_request_id>", api.LeaveRequestDetailAPIView.as_view()),
    path("leave-requests/<int:leave_request_id>/approve", api.LeaveRequestApproveAPIView.as_view()),
    path("leave-requests/<int:leave_request_id>/reject", api.LeaveRequestRejectAPIView.as_view()),
    path("leave-requests/<int:leave_request_id>/delegate", api.LeaveRequestDelegateAPIView.as_view()),
    path("leave-policies", api.LeavePolicyListCreateAPIView.as_view()),
    path("leave-policies/<int:policy_id>", api.LeavePolicyDetailAPIView.as_view()),
    path("leave-policies/<int:policy_id>/renew", api.LeavePolicyRenewAPIView.as_view()),
    path("leave-policies/<int:policy_id>/carry-forward-preview", api.LeavePolicyCarryForwardPreviewAPIView.as_view()),
    path("leave-reports/balances", api.LeaveReportBalancesAPIView.as_view()),
    path("holidays", api.HolidayListCreateAPIView.as_view()),
    path("holidays/<int:holiday_id>", api.HolidayDetailAPIView.as_view()),
]
