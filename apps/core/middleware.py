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

import sys
import traceback

from django.http import HttpResponseForbidden

from .tenancy import set_current_organization_id


def _dbg(msg):
    print(f"[LOGIN-DEBUG] TenantMiddleware: {msg}", file=sys.stderr, flush=True)


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _dbg(f"__call__: {request.method} {request.path}")
        organization_id = None
        user = getattr(request, "user", None)
        is_authenticated = user is not None and getattr(user, "is_authenticated", False)
        _dbg(f"__call__: user={user!r} is_authenticated={is_authenticated}")
        if is_authenticated:
            organization_id = getattr(user, "organization_id", None)

        request.organization_id = organization_id
        _dbg(f"__call__: organization_id={organization_id} - calling get_response")
        set_current_organization_id(organization_id)
        try:
            response = self.get_response(request)
            _dbg(f"__call__: get_response returned status={getattr(response, 'status_code', '?')}")
        except Exception:
            _dbg("__call__: UNHANDLED EXCEPTION from get_response - traceback follows")
            traceback.print_exc(file=sys.stderr)
            sys.stderr.flush()
            raise
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
