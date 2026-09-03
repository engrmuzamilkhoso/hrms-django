"""Direct port of app/Services/AiCreditService.php."""

from apps.organization.models import Organization, OrganizationSetting

from .models import AiCreditTransaction

COST_CV_SCORING = 10
COST_RESUME_PARSE = 5
COST_PAYROLL_ANOMALY = 20


def consume(organization_id, operation_type, credits):
    organization = Organization.objects.get(pk=organization_id)
    if organization.ai_credit_balance < credits:
        return False

    organization.ai_credit_balance -= credits
    organization.save()

    AiCreditTransaction.objects.create(
        organization_id=organization_id,
        operation_type=operation_type,
        credits_delta=-credits,
        balance_after=organization.ai_credit_balance,
    )

    setting = OrganizationSetting.objects.filter(organization_id=organization_id).first()
    if setting and organization.ai_credit_balance <= setting.low_ai_credit_threshold:
        pass  # Hook for low-balance notification (unimplemented in the source app too)

    return True
