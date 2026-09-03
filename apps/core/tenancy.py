"""
Multi-tenancy primitives - Django equivalent of Laravel's
App\\Services\\TenantContext + App\\Models\\Concerns\\BelongsToOrganization.

Laravel resolved organization_id once per request (ResolveTenant middleware),
stashed it in a request-scoped TenantContext service, and every tenant model
used a global Eloquent scope that filtered by it and auto-stamped it on create.
Here a ContextVar plays the same role as the container-scoped TenantContext,
set by TenantMiddleware (see middleware.py) for the lifetime of the request.
"""

from contextvars import ContextVar

_current_organization_id: ContextVar[int | None] = ContextVar(
    "current_organization_id", default=None
)


def get_current_organization_id() -> int | None:
    return _current_organization_id.get()


def set_current_organization_id(organization_id: int | None) -> None:
    _current_organization_id.set(organization_id)
