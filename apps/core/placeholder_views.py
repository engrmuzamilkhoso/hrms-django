"""
Temporary scaffolding view used by not-yet-migrated modules' urls.py so the
full nav is clickable/navigable end-to-end from Phase 1 onward, without
waiting for every module's real UI. Each app's urls.py wraps this with the
correct role-gate decorator (admin_required/login_required_view) matching
platform/layout.tsx's adminOnlyPrefixes guard, and gets replaced with real
views as that module is migrated.
"""

from django.shortcuts import render


def module_placeholder(request, title, subtitle=None, note=None):
    return render(
        request,
        "partials/_module_placeholder.html",
        {"page_title": title, "page_subtitle": subtitle, "page_note": note},
    )
