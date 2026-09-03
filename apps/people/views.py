"""
Template views for /dashboard/employees/* and /platform/designations/*.
Data loads client-side via the preserved /api/v1/* endpoints (same pattern
as the React pages), so these views mostly just render the page shell.
"""

from django.shortcuts import render


def legacy_employees(request):
    """Port of app/employees/page.tsx - a bare, orphaned legacy page with no
    auth guard or shared layout in the original either."""
    return render(request, "people/legacy_employees.html", {})


def employee_list(request):
    return render(request, "people/employee_list.html", {})


def employee_create(request):
    return render(
        request,
        "people/employee_create.html",
        {"currency_options": ["PKR", "USD", "GBP", "EUR", "AED", "SAR"]},
    )


def employee_detail(request, employee_id):
    return render(
        request,
        "people/employee_detail.html",
        {"employee_id": employee_id, "currency_options": ["PKR", "USD", "GBP", "EUR", "AED", "SAR"]},
    )


def employee_import(request):
    return render(request, "people/employee_import.html", {})


def designation_list(request):
    return render(request, "people/designation_list.html", {})
