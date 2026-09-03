from django.shortcuts import render


def recruitment_home(request):
    return render(request, "recruitment/home.html", {})
