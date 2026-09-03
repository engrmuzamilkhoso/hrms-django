from apps.core.views import EnvelopeAPIView
from apps.organization.models import Organization

from .models import AiCreditTransaction
from .serializers import AiCreditTransactionSerializer


class CreditLedgerAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = AiCreditTransaction.objects.order_by("-id")
        return self.paginated_ok(request, qs, AiCreditTransactionSerializer, default_per_page=50)


class CreditTopUpAPIView(EnvelopeAPIView):
    def post(self, request):
        credits = int(request.data.get("credits", 0))
        if credits < 1:
            return self.error(
                "The given data was invalid.", 422, errors={"credits": ["Must be at least 1."]}
            )

        org = Organization.objects.get(pk=request.user.organization_id)
        org.ai_credit_balance += credits
        org.save()

        tx = AiCreditTransaction.objects.create(
            organization_id=org.id, operation_type="top_up", credits_delta=credits, balance_after=org.ai_credit_balance,
        )
        return self.ok(AiCreditTransactionSerializer(tx).data, "Credits topped up")
