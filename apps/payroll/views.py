from django.shortcuts import render


def payroll_home(request):
    return render(request, "payroll/home.html", {})


def accounting_integration(request):
    return render(request, "payroll/accounting_integration.html", {})
