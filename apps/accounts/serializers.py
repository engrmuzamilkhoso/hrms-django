from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Mirrors User::$hidden = ['password', 'remember_token'] (app/Models/User.php:33-36)."""

    class Meta:
        model = User
        fields = [
            "id",
            "organization_id",
            "employee_id",
            "name",
            "email",
            "is_active",
            "is_super_admin",
            "email_verified_at",
            "last_login",
            "created_at",
            "updated_at",
        ]


class OrgUserSerializer(serializers.ModelSerializer):
    """Mirrors InviteController::index()'s per-user shape (People\\InviteController.php)."""

    roles = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()
    designation = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "is_active", "roles", "employee_code", "designation", "created_at"]

    def get_roles(self, obj):
        return list(obj.roles.values_list("name", flat=True))

    def get_employee_code(self, obj):
        employee = getattr(obj, "employee", None)
        return employee.employee_code if employee else None

    def get_designation(self, obj):
        employee = getattr(obj, "employee", None)
        return employee.designation_text if employee else None


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


class RegisterOrganizationSerializer(serializers.Serializer):
    organization_name = serializers.CharField(max_length=180)
    country_code = serializers.CharField(min_length=2, max_length=2)
    industry = serializers.CharField(max_length=120)
    default_currency = serializers.CharField(min_length=3, max_length=3)
    timezone = serializers.CharField(max_length=64)
    email = serializers.EmailField(max_length=190)
    password = serializers.CharField(min_length=8)
    plan_code = serializers.ChoiceField(
        choices=["trial", "silver", "gold", "platinum", "custom"], required=False
    )


class VerifySignupOtpSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(min_length=4, max_length=12)
    purpose = serializers.ChoiceField(choices=["org_signup_verify"])


class ResendOtpSerializer(serializers.Serializer):
    email = serializers.EmailField()
    purpose = serializers.ChoiceField(choices=["org_signup_verify"])
