from django.urls import NoReverseMatch, reverse

from . import nav as nav_module

# Mirrors platform/layout.tsx:185-187 EXACT_MATCH_HREFS - these routes use
# exact-path matching for the "active" sidebar state, everything else uses
# startswith (so e.g. /people/employees/42/ still highlights "Employees").
EXACT_MATCH_URL_NAMES = {"core:platform_home", "core:manager_home", "core:me_home"}


def _resolve_items(items, request):
    resolved = []
    for item in items:
        try:
            url = reverse(item["href"])
        except NoReverseMatch:
            continue
        active = (
            request.path == url
            if item["href"] in EXACT_MATCH_URL_NAMES
            else request.path.startswith(url)
        )
        if item.get("qs"):
            url = f"{url}?{item['qs']}"
        resolved.append({**item, "url": url, "active": active})
    return resolved


def nav_context(request):
    user = getattr(request, "user", None)
    if user is None or not user.is_authenticated:
        return {}

    roles = user.get_role_names()
    is_super_admin = bool(getattr(user, "is_super_admin", False))

    if is_super_admin:
        items = _resolve_items(nav_module.SUPER_ADMIN_NAV, request)
        groups = []
    else:
        raw_items = nav_module.get_nav_by_roles(roles, is_super_admin)
        items = _resolve_items(raw_items, request)
        groups = list(dict.fromkeys(i["group"] for i in raw_items))

    return {
        "nav_items": items,
        "nav_groups": groups,
        "nav_user_roles": roles,
        "nav_is_super_admin": is_super_admin,
        "nav_is_admin": nav_module.is_org_admin(roles),
        "nav_is_manager": nav_module.is_manager(roles),
    }
