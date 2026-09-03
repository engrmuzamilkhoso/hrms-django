from rest_framework import serializers

from .models import ExitSettlement, ExitWorkflow


class ExitWorkflowSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExitWorkflow
        fields = [
            "id", "employee_id", "exit_type", "exit_date", "short_notice_recovery",
            "outstanding_salary", "leave_encashment", "gratuity_amount", "loan_recovery",
            "final_settlement_amount", "clearance_override", "clearance_override_reason",
            "created_at", "updated_at",
        ]


class ExitSettlementSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExitSettlement
        fields = [
            "id", "organization_id", "exit_workflow_id", "employee_id", "outstanding_salary",
            "leave_encashment", "gratuity_amount", "loan_recovery", "net_settlement", "status",
            "override_reason", "created_at", "updated_at",
        ]
