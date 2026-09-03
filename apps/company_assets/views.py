from django.shortcuts import render


def assets_home(request):
    return render(request, "company_assets/home.html", {})
