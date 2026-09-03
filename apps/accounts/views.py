"""
Template views for /auth/* - server-rendered equivalents of
saas-hrms-frontend/app/auth/{login,register,verify-otp}/page.tsx. Session +
CSRF auth replaces the SPA's bearer-token-in-localStorage flow (see plan:
architecture decisions / Auth); the underlying business rules (OTP-gated
registration, exact error messages, role-based redirect target) are ported
1:1 from the Laravel controllers via apps.accounts.services.
"""

import sys
import traceback

from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views import View

from apps.core.nav import resolve_home

from . import services
from .forms import LoginForm, ResendOtpForm, VerifyOtpForm


def _dbg(msg):
    print(f"[LOGIN-DEBUG] {msg}", file=sys.stderr, flush=True)


def _redirect_home(user):
    _dbg(f"_redirect_home: fetching roles for user_id={user.id}")
    roles = services.get_user_roles(user)
    _dbg(f"_redirect_home: roles={roles} is_super_admin={user.is_super_admin}")
    target = resolve_home(roles, user.is_super_admin)
    _dbg(f"_redirect_home: resolve_home -> {target!r}")
    return redirect(target)


class LoginView(View):
    template_name = "auth/login.html"

    def get(self, request):
        if request.user.is_authenticated:
            return _redirect_home(request.user)
        return render(request, self.template_name, {"form": LoginForm(), "verified": request.GET.get("verified") == "1"})

    def post(self, request):
        _dbg("post(): received login POST")
        try:
            form = LoginForm(request.POST)
            error = None
            _dbg("post(): validating form")
            if form.is_valid():
                _dbg(f"post(): form valid, email={form.cleaned_data['email']!r} - calling authenticate_login")
                user, error = services.authenticate_login(
                    form.cleaned_data["email"], form.cleaned_data["password"]
                )
                _dbg(f"post(): authenticate_login returned user={user!r} error={error!r}")
                if user:
                    user.backend = "apps.accounts.backends.LaravelStyleBackend"
                    _dbg(f"post(): calling django_login for user_id={user.id}")
                    django_login(request, user)
                    _dbg("post(): django_login succeeded, session established - resolving redirect")
                    return _redirect_home(user)
            else:
                _dbg(f"post(): form invalid, errors={form.errors!r}")
                error = "Please enter a valid email and password."
            _dbg("post(): rendering login template with error")
            return render(request, self.template_name, {"form": form, "error": error, "verified": False})
        except Exception:
            _dbg("post(): UNHANDLED EXCEPTION - traceback follows")
            traceback.print_exc(file=sys.stderr)
            sys.stderr.flush()
            raise


class LogoutView(View):
    def post(self, request):
        django_logout(request)
        return redirect("accounts:login")


class RegisterView(View):
    """GET-only shell: the two-step form/OTP flow (with live countdown ring)
    is JS-driven against /api/v1/auth/register-organization and
    /api/v1/auth/verify-signup-otp, matching app/auth/register/page.tsx's
    behavior exactly (no full-page reload between steps)."""

    template_name = "auth/register.html"

    def get(self, request):
        return render(request, self.template_name, {})


class VerifyOtpView(View):
    template_name = "auth/verify_otp.html"

    def get(self, request):
        return render(
            request,
            self.template_name,
            {"form": VerifyOtpForm(initial={"email": request.GET.get("email", "")})},
        )

    def post(self, request):
        form = VerifyOtpForm(request.POST)
        message, is_error = None, True
        if form.is_valid():
            user, error, org = services.verify_signup_otp(
                form.cleaned_data["email"], form.cleaned_data["otp_code"]
            )
            if user:
                is_error = False
                message = "Verification successful. You can now sign in."
            else:
                message = error
        else:
            message = "Please enter a valid email and 4-12 character code."
        return render(request, self.template_name, {"form": form, "message": message, "is_error": is_error})


class ResendOtpView(View):
    def post(self, request):
        form = ResendOtpForm(request.POST)
        if form.is_valid():
            from .models import User

            email = form.cleaned_data["email"]
            user = User.objects.filter(email=email, email_verified_at__isnull=True).first()
            if user:
                services.resend_otp(email, "org_signup_verify")
        return redirect(f"{reverse('accounts:verify_otp')}?email={request.POST.get('email', '')}")
