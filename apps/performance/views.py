from django.shortcuts import render


def performance_home(request):
    return render(request, "performance/home.html", {})
