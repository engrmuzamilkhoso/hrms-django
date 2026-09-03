from django.db import models

from apps.organization.models import Organization


class AiCreditTransaction(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    operation_type = models.CharField(max_length=60)
    credits_delta = models.IntegerField()
    balance_after = models.IntegerField()
    reference_type = models.CharField(max_length=80, null=True, blank=True)
    reference_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_credit_transactions"
        managed = True
