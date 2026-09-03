"""
Django Form equivalents of app/Http/Requests/Auth/{LoginRequest,
RegisterOrganizationRequest}.php - same field set and constraints.
"""

from django import forms

PLAN_CHOICES = [("trial", "Trial"), ("silver", "Silver"), ("gold", "Gold"), ("platinum", "Platinum"), ("custom", "Custom")]


class LoginForm(forms.Form):
    email = forms.EmailField(required=True)
    password = forms.CharField(required=True, widget=forms.PasswordInput)


class RegisterOrganizationForm(forms.Form):
    organization_name = forms.CharField(required=True, max_length=180)
    country_code = forms.CharField(required=True, min_length=2, max_length=2)
    industry = forms.CharField(required=True, max_length=120)
    default_currency = forms.CharField(required=True, min_length=3, max_length=3)
    timezone = forms.CharField(required=True, max_length=64)
    email = forms.EmailField(required=True, max_length=190)
    password = forms.CharField(required=True, min_length=8, widget=forms.PasswordInput)
    plan_code = forms.ChoiceField(required=False, choices=PLAN_CHOICES)


class VerifyOtpForm(forms.Form):
    email = forms.EmailField(required=True)
    otp_code = forms.CharField(required=True, min_length=4, max_length=12)


class ResendOtpForm(forms.Form):
    email = forms.EmailField(required=True)
