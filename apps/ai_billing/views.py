from django.shortcuts import render

from apps.core.decorators import admin_required


@admin_required
def home(request):
    """Full visual port of app/platform/ai-billing/page.tsx."""
    return render(request, "ai_billing/home.html", {})
