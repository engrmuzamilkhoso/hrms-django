from django.shortcuts import render


def attendance_home(request):
    return render(request, "attendance/home.html", {})


def holidays_shifts(request):
    return render(request, "attendance/holidays_shifts.html", {})
