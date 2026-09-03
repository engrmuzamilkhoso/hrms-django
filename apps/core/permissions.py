"""
DRF permission classes mirroring Laravel's per-request authorization checks:
- FormRequest::authorize() `$this->user()->hasRole([...])` checks
  (e.g. app/Http/Requests/People/StoreEmployeeRequest.php:9-12)
- the copy-pasted `checkOrgAccess($authOrgId, $resourceOrgId)` 403 helper
  duplicated in nearly every simple-resource controller
- App\\Http\\Middleware\\SuperAdminMiddleware, applied to `/platform/*`
"""

from rest_framework.permissions import BasePermission


class HasRole(BasePermission):
    """Usage: `permission_classes = [HasRole.of(['Org Admin', 'HR Manager'])]`"""

    roles: tuple[str, ...] = ()

    @classmethod
    def of(cls, roles):
        return type("HasRoleScoped", (cls,), {"roles": tuple(roles)})

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.has_role(self.roles))


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "is_super_admin", False))


class IsSameOrganization(BasePermission):
    """Object-level check replacing the copy-pasted `checkOrgAccess()` found
    in e.g. People\\EmployeeController, Organization\\OfficeController."""

    def has_object_permission(self, request, view, obj):
        resource_org_id = getattr(obj, "organization_id", None)
        return resource_org_id is not None and resource_org_id == request.user.organization_id
