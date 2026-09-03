"""
Business logic ported from App\\Http\\Controllers\\Auth\\{LoginController,
RegistrationController,VerificationController} and App\\Services\\OtpService.
Kept as plain functions (Django has no per-call DI container the way
Laravel's method-injected services worked) called directly from
apps.accounts.api / apps.accounts.views.
"""

import random
import sys
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.text import slugify

from apps.access.models import Role, UserRoleAssignment
from apps.organization.models import Organization, OrganizationSetting

from .models import EmailOtp, User

PREDEFINED_ROLES = [
    "Org Admin",
    "HR Manager",
    "Team Lead",
    "Employee",
    "Finance Viewer",
    "Recruiter",
    "Interviewer",
]

PLAN_LIMITS = {"trial": 20, "silver": 30, "gold": 50, "platinum": 100}


# ---------------------------------------------------------------------------
# Login - mirrors LoginController::login() exactly, including its quirk of
# looking up by email globally (first match) rather than per-organization.
# ---------------------------------------------------------------------------
def authenticate_login(email, password):
    def _dbg(msg):
        print(f"[LOGIN-DEBUG] authenticate_login: {msg}", file=sys.stderr, flush=True)

    _dbg(f"looking up user for email={email!r}")
    user = User.objects.filter(email=email).order_by("id").first()
    _dbg(f"user lookup result: {user!r}")

    _dbg("checking password")
    password_ok = bool(user) and user.check_password(password)
    _dbg(f"password_ok={password_ok}")
    if not password_ok:
        return None, "Invalid credentials"

    _dbg(f"checking is_active={user.is_active}")
    if not user.is_active:
        return None, "Your account has been deactivated. Contact your administrator."

    _dbg(f"checking org status, organization_id={user.organization_id} is_super_admin={user.is_super_admin}")
    if user.organization_id and not user.is_super_admin:
        org = Organization.objects.filter(pk=user.organization_id).first()
        _dbg(f"org lookup result: {org!r} status={getattr(org, 'status', None)!r}")
        if org and org.status == "inactive":
            return None, "Your organization has been deactivated. Please contact platform support."

    _dbg("all checks passed, returning user")
    return user, None


def get_user_roles(user):
    return list(user.get_role_names())


def is_manager_user(user):
    from apps.people.models import Employee

    if user.employee_id:
        is_mgr = Employee.objects.filter(
            reporting_manager_id=user.employee_id, organization_id=user.organization_id
        ).exists()
        if is_mgr:
            return True
    return "Team Lead" in get_user_roles(user)


# ---------------------------------------------------------------------------
# OTP - mirrors App\Services\OtpService.php exactly (2-minute expiry, 6-digit
# numeric code, latest-unverified-record lookup).
# ---------------------------------------------------------------------------
def issue_otp(organization_id, email, purpose):
    otp = EmailOtp.objects.create(
        organization_id=organization_id,
        email=email,
        purpose=purpose,
        otp_code=f"{random.randint(100000, 999999)}",
        expires_at=timezone.now() + timedelta(minutes=settings.OTP_EXPIRES_MINUTES),
    )
    send_otp_email(otp)
    return otp


def resend_otp(email, purpose):
    existing = (
        EmailOtp.objects.filter(email=email, purpose=purpose, verified_at__isnull=True)
        .order_by("-id")
        .first()
    )
    organization_id = existing.organization_id if existing else None

    EmailOtp.objects.filter(email=email, purpose=purpose, verified_at__isnull=True).update(
        expires_at=timezone.now() - timedelta(seconds=1)
    )

    return issue_otp(organization_id, email, purpose)


def verify_otp(email, purpose, code):
    record = (
        EmailOtp.objects.filter(
            email=email, purpose=purpose, otp_code=code, verified_at__isnull=True
        )
        .filter(expires_at__gt=timezone.now())
        .order_by("-id")
        .first()
    )
    if not record:
        return None
    record.verified_at = timezone.now()
    record.save(update_fields=["verified_at", "updated_at"])
    return record


def send_otp_email(otp, expires_in_minutes=None):
    expires_in_minutes = expires_in_minutes or settings.OTP_EXPIRES_MINUTES
    html = render_to_string(
        "emails/otp.html",
        {"otp_code": otp.otp_code, "expires_minutes": expires_in_minutes},
    )
    send_mail(
        subject="Your verification code — WorkForce HRMS",
        message=f"Your WorkForce HRMS verification code is {otp.otp_code}. It expires in {expires_in_minutes} minutes.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[otp.email],
        html_message=html,
    )


# ---------------------------------------------------------------------------
# Registration - mirrors RegistrationController::registerOrganization()
# ---------------------------------------------------------------------------
def unique_slug(name):
    base = slugify(name)
    slug = base
    i = 1
    while Organization.objects.filter(slug=slug).exists():
        slug = f"{base}-{i}"
        i += 1
    return slug


def register_organization(payload):
    plan_code = payload.get("plan_code") or "trial"
    user_limit = PLAN_LIMITS.get(plan_code, 20)

    organization = Organization.objects.create(
        name=payload["organization_name"],
        slug=unique_slug(payload["organization_name"]),
        country_code=payload["country_code"].upper(),
        industry=payload["industry"],
        default_currency=payload["default_currency"].upper(),
        timezone=payload["timezone"],
        status="pending_verification",
        plan_code=plan_code,
        trial_user_limit=user_limit,
        ai_credit_balance=100,
    )

    OrganizationSetting.objects.create(
        organization=organization,
        hr_mode="global",
        free_tier_employee_limit=20,
        low_ai_credit_threshold=50,
        seed_data_enabled=True,
    )

    admin = User.objects.create_user(
        email=payload["email"],
        password=payload["password"],
        organization=organization,
        name=payload["organization_name"],
        is_active=False,
    )

    for role_name in PREDEFINED_ROLES:
        Role.objects.get_or_create(
            organization=organization,
            name=role_name,
            defaults={"description": role_name, "is_system": True},
        )
    org_admin_role = Role.objects.get(organization=organization, name="Org Admin")
    UserRoleAssignment.objects.get_or_create(user=admin, role=org_admin_role)

    from .seed import seed_data_for_organization

    seed_data_for_organization(organization.id)

    otp = issue_otp(organization.id, payload["email"], "org_signup_verify")

    return organization, admin, otp


def verify_signup_otp(email, otp_code):
    otp = verify_otp(email, "org_signup_verify", otp_code)
    if not otp:
        return None, "Invalid or expired OTP", None

    user = User.objects.filter(email=email, email_verified_at__isnull=True).first()
    if not user:
        return None, "User not found or already verified.", None

    org = Organization.objects.get(pk=user.organization_id)
    org.status = "trial" if org.plan_code == "trial" else "active"
    org.save(update_fields=["status", "updated_at"])

    user.is_active = True
    user.email_verified_at = timezone.now()
    user.save(update_fields=["is_active", "email_verified_at", "updated_at"])

    return user, None, org
