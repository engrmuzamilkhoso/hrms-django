"""
TenantMiddleware - Django equivalent of Laravel's
App\\Http\\Middleware\\ResolveTenant.

Laravel applied this to almost the entire authenticated API surface
(`Route::middleware(['auth:sanctum', 'tenant.resolve'])`), 403-ing if the
authenticated user had no organization_id. Here it runs after
AuthenticationMiddleware for every request; views that need a tenant use the
`apps.core.permissions.HasOrganization`/`TenantScopedAPIView` checks, which
inspect `request.organization_id` the same way Laravel controllers did.
"""

from django.http import HttpResponseForbidden

from .tenancy import set_current_organization_id


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        organization_id = None
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            organization_id = getattr(user, "organization_id", None)

        request.organization_id = organization_id
        set_current_organization_id(organization_id)
        try:
            response = self.get_response(request)
        finally:
            set_current_organization_id(None)
        return response


class SuperAdminRequiredMixin:
    """Django equivalent of Laravel's SuperAdminMiddleware, as a view mixin
    for template views (DRF has its own IsSuperAdmin permission class)."""

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated or not getattr(
            request.user, "is_super_admin", False
        ):
            return HttpResponseForbidden("Super admin access required")
        return super().dispatch(request, *args, **kwargs)
