"""
Server-side equivalent of the client-side auth/role guard duplicated across
platform/layout.tsx:128-174, super-admin/layout.tsx:29-42, and
dashboard/page.tsx:22-25 (Next.js pages rendered nothing until a client
effect re-fetched /auth/me and redirected). Django enforces this before the
view ever renders instead.
"""

from functools import wraps

from django.shortcuts import redirect

from .nav import ADMIN_ROLES, MANAGER_ROLES, resolve_home


def login_required_view(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect("accounts:login")
        return view_func(request, *args, **kwargs)

    return wrapper


def admin_required(view_func):
    """Mirrors the adminOnlyPrefixes redirect (platform/layout.tsx:150-159)."""

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect("accounts:login")
        if request.user.is_super_admin:
            return redirect("platform_admin:super_dashboard")
        roles = request.user.get_role_names()
        if not any(r in ADMIN_ROLES for r in roles):
            return redirect(resolve_home(roles, False))
        return view_func(request, *args, **kwargs)

    return wrapper


def super_admin_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect("accounts:login")
        if not request.user.is_super_admin:
            return redirect("core:home_redirect")
        return view_func(request, *args, **kwargs)

    return wrapper


def role_required(*roles):
    """Generic per-role gate, e.g. @role_required('Team Lead')."""

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect("accounts:login")
            user_roles = request.user.get_role_names()
            if not any(r in roles for r in user_roles) and not request.user.is_super_admin:
                return redirect(resolve_home(user_roles, request.user.is_super_admin))
            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator
