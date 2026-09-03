"""
DRF views for /api/v1/auth/* - ported 1:1 from
App\\Http\\Controllers\\Auth\\{LoginController,RegistrationController,
VerificationController}. Preserved primarily so the register/verify-otp
templates' JS (same two-step, live-countdown UX as the React page) can call
the same network contract; the login/logout template views use a plain
session form POST instead (see apps.accounts.views), but these endpoints
remain available/byte-compatible for any other API caller.
"""

from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.core.views import EnvelopeAPIView

from . import services
from .models import User
from .serializers import (
    LoginSerializer,
    RegisterOrganizationSerializer,
    ResendOtpSerializer,
    UserSerializer,
    VerifySignupOtpSerializer,
)


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
