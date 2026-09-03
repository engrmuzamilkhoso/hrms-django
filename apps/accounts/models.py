"""
Mirrors app/Models/User.php and the email_otps table (backs
App\\Services\\OtpService's registration/verification flow).
"""

from django.contrib.auth.base_user import AbstractBaseUser
from django.db import models

from .managers import UserManager


class User(AbstractBaseUser):
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        db_column="organization_id",
        null=True,
        blank=True,
        related_name="users",
    )
    employee = models.ForeignKey(
        "people.Employee",
        on_delete=models.DO_NOTHING,
        db_column="employee_id",
        db_constraint=False,
        null=True,
        blank=True,
        related_name="user_accounts",
    )
    name = models.CharField(max_length=140)
    email = models.CharField(max_length=190)
    password = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    is_super_admin = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    last_login = models.DateTimeField(null=True, blank=True, db_column="last_login_at")
    remember_token = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        db_table = "users"
        managed = True
        unique_together = (("organization", "email"),)

    def __str__(self):
        return self.email

    # ---- RBAC helpers, mirror app/Models/User.php:43-47 -------------------
    def get_role_names(self):
        if not self.pk:
            return []
        return list(self.roles.values_list("name", flat=True))

    def has_role(self, roles):
        if isinstance(roles, str):
            roles = [roles]
        return self.roles.filter(name__in=roles).exists()

    def check_password(self, raw_password):
        """
        Django's stock check_password()/identify_hasher() picks a hasher by
        splitting the encoded string on "$" and treating the first segment
        as a literal algorithm name (e.g. "pbkdf2_sha256$..."). Raw bcrypt
        strings ($2y$/$2a$/$2b$...) start WITH "$", so that split yields ''
        and dispatch fails outright - this affects both the existing
        Laravel-hashed rows and any new hash our own LaravelBcryptPasswordHasher
        would produce. Bypass the hasher registry entirely for bcrypt-shaped
        hashes and verify directly instead.
        """
        if self.password and self.password.startswith(("$2y$", "$2a$", "$2b$", "$2x$")):
            from .hashers import LaravelBcryptPasswordHasher

            return LaravelBcryptPasswordHasher().verify(raw_password, self.password)
        return super().check_password(raw_password)

    # ---- minimal permission-framework stubs (no django.contrib.auth
    # Group/Permission usage - RBAC is fully custom, see apps.access) -----
    @property
    def is_staff(self):
        return self.is_super_admin

    def has_perm(self, perm, obj=None):
        return self.is_super_admin

    def has_module_perms(self, app_label):
        return self.is_super_admin


class EmailOtp(models.Model):
    """Mirrors app/Services/OtpService.php + email_otps table."""

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        db_column="organization_id",
        null=True,
        blank=True,
    )
    email = models.CharField(max_length=190)
    purpose = models.CharField(max_length=40)  # org_signup_verify, candidate_magic_link
    otp_code = models.CharField(max_length=12)
    expires_at = models.DateTimeField()
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "email_otps"
        managed = True
