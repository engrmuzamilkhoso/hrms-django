from django.shortcuts import render


def onboarding_exit_home(request):
    return render(request, "onboarding/home.html", {})
