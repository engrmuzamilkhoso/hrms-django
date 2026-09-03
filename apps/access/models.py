"""
Mirrors app/Models/{Role,Permission}.php and the role_permissions/user_roles
pivot tables (app/Http/Controllers/Access/*). Both pivot tables use a
composite primary key in the real schema (no `id` column -
`PRIMARY KEY (role_id, permission_id)` / `PRIMARY KEY (user_id, role_id)`,
see database/migrations/2026_01_01_000005_create_access_control_tables.php),
hence CompositePrimaryKey rather than Django's default surrogate id.
"""

from django.db import models

from apps.accounts.models import User
from apps.core.models import TenantScopedModel
from apps.organization.models import Organization


class Role(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    name = models.CharField(max_length=120)
    description = models.CharField(max_length=255, null=True, blank=True)
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    permissions = models.ManyToManyField(
        "Permission", through="RolePermission", related_name="roles"
    )
    users = models.ManyToManyField(User, through="UserRoleAssignment", related_name="roles")

    class Meta:
        db_table = "roles"
        managed = True
        unique_together = (("organization", "name"),)

    def __str__(self):
        return self.name


class Permission(models.Model):
    """Global permission catalog - not tenant-scoped (no organization_id
    column), seed data only (ported from database/seeders/PermissionSeeder.php
    by apps.access.management.commands.seed_permissions)."""

    code = models.CharField(max_length=120, unique=True)
    module = models.CharField(max_length=80)
    action = models.CharField(max_length=30)
    description = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = "permissions"
        managed = True

    def __str__(self):
        return self.code


class RolePermission(models.Model):
    pk = models.CompositePrimaryKey("role_id", "permission_id")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, db_column="role_id")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, db_column="permission_id")

    class Meta:
        db_table = "role_permissions"
        managed = True


class UserRoleAssignment(models.Model):
    pk = models.CompositePrimaryKey("user_id", "role_id")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, db_column="role_id")

    class Meta:
        db_table = "user_roles"
        managed = True
