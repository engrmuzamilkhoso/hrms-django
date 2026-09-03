"""
Base model classes shared by every domain app.

TenantScopedModel is the Django equivalent of Laravel's
App\\Models\\Concerns\\BelongsToOrganization trait: it adds the
organization FK, auto-stamps it from the current tenant context on save if
unset (mirrors the `creating` hook), and its default manager transparently
filters every query by the current tenant (mirrors the Eloquent global
scope). `all_objects` is the escape hatch for cross-tenant/internal queries,
matching Laravel's `withoutGlobalScopes()` usage (e.g. LeaveCalculationService).
"""

from django.core.serializers.json import DjangoJSONEncoder
from django.db import models

from .tenancy import get_current_organization_id


class TenantManager(models.Manager):
    def get_queryset(self):
        qs = super().get_queryset()
        organization_id = get_current_organization_id()
        if organization_id is not None:
            qs = qs.filter(organization_id=organization_id)
        return qs


class TenantScopedModel(models.Model):
    """Abstract base for every table that carries organization_id.

    Concrete subclasses must still declare their own `organization` FK
    (field name/db_column vary slightly across the ported Laravel tables),
    but get `objects`/`all_objects` and the auto-stamp-on-create behavior
    for free by calling `stamp_organization()` in their save().
    """

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def stamp_organization_id(self):
        if self.organization_id is None:  # type: ignore[attr-defined]
            tenant_id = get_current_organization_id()
            if tenant_id is not None:
                self.organization_id = tenant_id  # type: ignore[attr-defined]

    def save(self, *args, **kwargs):
        self.stamp_organization_id()
        super().save(*args, **kwargs)


class AuditLog(models.Model):
    """Mirrors Laravel's audit_logs table (App\\Models\\AuditLog).
    Not exposed via any API route in the source app - internal audit trail
    only, written by apps.core.services.audit.log_action()."""

    organization = models.ForeignKey(
        "organization.Organization", on_delete=models.CASCADE, db_column="organization_id"
    )
    actor_user_id = models.BigIntegerField(null=True, blank=True)
    action = models.CharField(max_length=140)
    entity_type = models.CharField(max_length=80)
    entity_id = models.BigIntegerField()
    before_json = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    after_json = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    ip_address = models.CharField(max_length=64, null=True, blank=True)
    user_agent = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_logs"
        managed = True


class Country(models.Model):
    """Mirrors System\\CountryController's `countries` table (read-only
    lookup data, no Eloquent model in Laravel - raw DB::table only)."""

    code = models.CharField(max_length=2, unique=True)
    name = models.CharField(max_length=100)
    flag = models.CharField(max_length=10, null=True, blank=True)
    dial_code = models.CharField(max_length=10, null=True, blank=True)
    region = models.CharField(max_length=50, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "countries"
        managed = True

    def __str__(self):
        return self.name


class FeatureFlag(models.Model):
    """Mirrors Settings\\FeatureFlagController's `feature_flags` table.
    Note: in Laravel this model does NOT use the BelongsToOrganization
    trait (organization_id is nullable/global-or-per-org) - preserved as-is,
    not silently made tenant-scoped."""

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        db_column="organization_id",
        null=True,
        blank=True,
    )
    flag_key = models.CharField(max_length=120)
    is_enabled = models.BooleanField(default=False)
    rollout_notes = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "feature_flags"
        managed = True
        unique_together = (("organization", "flag_key"),)
