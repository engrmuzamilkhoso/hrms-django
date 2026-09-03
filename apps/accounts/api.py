"""
DRF views for /api/v1/auth/* - ported 1:1 from
App\\Http\\Controllers\\Auth\\{LoginController,RegistrationController,
VerificationController}. Preserved primarily so the register/verify-otp
templates' JS (same two-step, live-countdown UX as the React page) can call
the same network contract; the login/logout template views use a plain
session form POST instead (see apps.accounts.views), but these endpoints
remain available/byte-compatible for any other API caller.
"""

import random
import string

from django.conf import settings
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.core.permissions import HasRole
from apps.core.views import EnvelopeAPIView

from . import services
from .models import User
from .serializers import (
    LoginSerializer,
    OrgUserSerializer,
    RegisterOrganizationSerializer,
    ResendOtpSerializer,
    UserSerializer,
    VerifySignupOtpSerializer,
)

ADMIN_ONLY = HasRole.of(["Org Admin", "HR Manager"])

# Roles the Users & Roles page is allowed to grant - Super Admin is
# deliberately excluded (mirrors InviteController::invite()'s explicit
# rejection of role === 'Super Admin').
ASSIGNABLE_ROLES = ["Org Admin", "HR Manager", "Team Lead", "Employee", "Finance Viewer", "Recruiter", "Interviewer"]
_AUTO_EMPLOYEE_ROLES = {"Employee", "Team Lead", "HR Manager", "Org Admin"}


def _generate_password():
    alphabet = string.ascii_letters + string.digits
    return "".join(random.choices(alphabet, k=10))


class RegisterOrganizationAPIView(EnvelopeAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterOrganizationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization, admin, otp = services.register_organization(serializer.validated_data)
        return self.ok(
            {
                "organization": {"id": organization.id, "name": organization.name, "slug": organization.slug},
                "admin": UserSerializer(admin).data,
                "verification_required": True,
                "otp_expires_at": otp.expires_at,
            },
            "Organization registered. Verify email OTP to activate account.",
            201,
        )


class VerifySignupOtpAPIView(EnvelopeAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifySignupOtpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, error, org = services.verify_signup_otp(
            serializer.validated_data["email"], serializer.validated_data["otp_code"]
        )
        if not user:
            status_code = 404 if error == "User not found or already verified." else 422
            return self.error(error, status_code)

        token, _ = Token.objects.get_or_create(user=user)
        return self.ok(
            {
                "token": token.key,
                "user": UserSerializer(user).data,
                "roles": services.get_user_roles(user),
            },
            "Email verified. Organization is active.",
        )


class ResendOtpAPIView(EnvelopeAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResendOtpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = User.objects.filter(email=email, email_verified_at__isnull=True).first()
        if not user:
            return self.error("No pending verification found for this email.", 422)

        otp = services.resend_otp(email, serializer.validated_data["purpose"])
        return self.ok({"otp_expires_at": otp.expires_at}, "A new code has been sent to your email.")


class LoginAPIView(EnvelopeAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, error = services.authenticate_login(
            serializer.validated_data["email"], serializer.validated_data["password"]
        )
        if not user:
            status_code = 403 if "deactivated" in (error or "") else 422
            return self.error(error, status_code)

        user.backend = "apps.accounts.backends.LaravelStyleBackend"
        django_login(request, user)
        token, _ = Token.objects.get_or_create(user=user)

        user_payload = UserSerializer(user).data
        user_payload["roles"] = services.get_user_roles(user)
        user_payload["is_super_admin"] = bool(user.is_super_admin)

        return self.ok({"token": token.key, "user": user_payload}, "Logged in")


class LogoutAPIView(EnvelopeAPIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        django_logout(request)
        return self.ok(None, "Logged out")


class MeAPIView(EnvelopeAPIView):
    def get(self, request):
        user = request.user
        roles = services.get_user_roles(user)
        is_manager = services.is_manager_user(user)

        user_payload = UserSerializer(user).data
        user_payload["roles"] = roles
        user_payload["is_super_admin"] = bool(user.is_super_admin)
        user_payload["is_manager"] = is_manager

        return self.ok(
            {
                "user": user_payload,
                "roles": roles,
                "is_super_admin": bool(user.is_super_admin),
                "is_manager": is_manager,
            }
        )


# ---------------------------------------------------------------------------
# /api/v1/users* - user account management, ported from
# App\\Http\\Controllers\\People\\InviteController (see apps/access/urls.py
# comment: not linked from the sidebar in the source app, but the same
# /platform/users page as here).
# ---------------------------------------------------------------------------
class UserListAPIView(EnvelopeAPIView):
    def get(self, request):
        users = (
            User.objects.filter(organization_id=request.user.organization_id)
            .select_related("employee")
            .prefetch_related("roles")
            .order_by("-created_at")
        )
        return self.ok(OrgUserSerializer(users, many=True).data)


class UserInviteAPIView(EnvelopeAPIView):
    permission_classes = [ADMIN_ONLY]

    def post(self, request):
        from apps.access.models import Role, UserRoleAssignment
        from apps.people.models import Employee

        data = request.data
        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip()
        role_name = data.get("role")
        if not name or not email or not role_name:
            return self.error(
                "The given data was invalid.", 422,
                errors={"name": ["required"], "email": ["required"], "role": ["required"]},
            )
        if role_name not in ASSIGNABLE_ROLES:
            return self.error("Super Admin accounts cannot be created from here.", 403)
        if User.objects.filter(email=email).exists():
            return self.error(
                "The given data was invalid.", 422, errors={"email": ["The email has already been taken."]}
            )

        org_id = request.user.organization_id
        plain_password = _generate_password()

        user = User.objects.create_user(
            email=email, password=plain_password, organization_id=org_id, name=name, is_active=True,
        )

        role = Role.objects.filter(organization_id=org_id, name=role_name).first()
        if role:
            UserRoleAssignment.objects.get_or_create(user=user, role=role)

        employee_id = data.get("employee_id")
        if employee_id:
            Employee.objects.filter(pk=employee_id, organization_id=org_id).update(user_id=user.id)
        elif role_name in _AUTO_EMPLOYEE_ROLES:
            base = Employee.all_objects.filter(organization_id=org_id).order_by("-id").first()
            seq = (base.id if base else 0) + 1
            code = f"EMP-{seq:04d}"
            while Employee.all_objects.filter(employee_code=code).exists():
                seq += 1
                code = f"EMP-{seq:04d}"
            Employee.objects.create(
                organization_id=org_id,
                user_id=user.id,
                full_name=name,
                email=email,
                employee_code=code,
                designation_text=data.get("designation") or role_name,
                department_id=data.get("department_id") or None,
                employment_status="active",
                hire_date=timezone.now().date(),
            )

        return self.ok(
            {
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "role": role_name,
                "password": plain_password,
                "login_url": f"{settings.FRONTEND_BASE_URL}/auth/login/",
            },
            "Account created successfully. Share the credentials with the user.",
        )


class UserActivateAPIView(EnvelopeAPIView):
    permission_classes = [ADMIN_ONLY]

    def post(self, request, user_id):
        user = get_object_or_404(User, pk=user_id, organization_id=request.user.organization_id)
        user.is_active = True
        user.save(update_fields=["is_active", "updated_at"])
        return self.ok(None, "User activated.")


class UserDeactivateAPIView(EnvelopeAPIView):
    permission_classes = [ADMIN_ONLY]

    def post(self, request, user_id):
        user = get_object_or_404(User, pk=user_id, organization_id=request.user.organization_id)
        user.is_active = False
        user.save(update_fields=["is_active", "updated_at"])
        return self.ok(None, "User deactivated.")


class UserResetPasswordAPIView(EnvelopeAPIView):
    permission_classes = [ADMIN_ONLY]

    def post(self, request, user_id):
        user = get_object_or_404(User, pk=user_id, organization_id=request.user.organization_id)
        plain_password = _generate_password()
        user.set_password(plain_password)
        user.save(update_fields=["password", "updated_at"])
        return self.ok({"email": user.email, "password": plain_password}, "Password reset. Share new credentials with the user.")
