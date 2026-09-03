from django.shortcuts import render


def leave_home(request):
    return render(request, "leave/home.html", {})
