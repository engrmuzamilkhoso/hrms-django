"""DRF views for /api/v1/employees/{id}/account* - ported from People\\EmployeeAccountController.php."""

import secrets
import string

from django.db import transaction
from django.shortcuts import get_object_or_404

from apps.access.models import Role, UserRoleAssignment
from apps.accounts.models import User
from apps.core.views import EnvelopeAPIView

from .models import Employee


def _get_employee(request, employee_id):
    return get_object_or_404(Employee, pk=employee_id, organization_id=request.user.organization_id)


def _is_manager_by_relationship(request, employee_id):
    return Employee.objects.filter(
        reporting_manager_id=employee_id, organization_id=request.user.organization_id
    ).exists()


def _managed_count(request, employee_id):
    return Employee.objects.filter(
        reporting_manager_id=employee_id, organization_id=request.user.organization_id
    ).count()


def _random_password(length=10):
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class EmployeeAccountAPIView(EnvelopeAPIView):
    def get(self, request, employee_id):
        employee = _get_employee(request, employee_id)
        is_manager = _is_manager_by_relationship(request, employee_id)
        managed_count = _managed_count(request, employee_id)

        user = User.objects.filter(pk=employee.user_id).first() if employee.user_id else None
        if not user:
            return self.ok(
                {"has_account": False, "is_manager_by_relationship": is_manager, "manages_count": managed_count}
            )

        roles = list(user.get_role_names())
        account_type = "manager" if "Team Lead" in roles else "user"

        return self.ok(
            {
                "has_account": True, "user_id": user.id, "email": user.email, "is_active": user.is_active,
                "account_type": account_type, "roles": roles, "created_at": user.created_at,
                "is_manager_by_relationship": is_manager, "manages_count": managed_count,
            }
        )

    @transaction.atomic
    def post(self, request, employee_id):
        employee = _get_employee(request, employee_id)
        org_id = request.user.organization_id

        if employee.user_id:
            return self.error("This employee already has a login account.", 422)

        email = request.data.get("email")
        account_type = request.data.get("account_type")
        if not email or account_type not in ("user", "manager"):
            return self.error(
                "The given data was invalid.", 422,
                errors={"email": ["Required."], "account_type": ["Must be user or manager."]},
            )
        if User.objects.filter(email=email).exists():
            return self.error("The given data was invalid.", 422, errors={"email": ["Already taken."]})

        role_name = "Team Lead" if account_type == "manager" else "Employee"
        plain_password = _random_password()

        user = User.objects.create_user(
            organization_id=org_id, employee_id=employee.id, name=employee.full_name, email=email,
            password=plain_password, is_active=True,
        )
        role = Role.objects.filter(organization_id=org_id, name=role_name).first()
        if role:
            UserRoleAssignment.objects.create(user=user, role=role)
        Employee.objects.filter(pk=employee.id).update(user_id=user.id)

        return self.ok(
            {"user_id": user.id, "email": user.email, "password": plain_password, "account_type": account_type},
            "Login account created.", 201,
        )

    @transaction.atomic
    def patch(self, request, employee_id):
        employee = _get_employee(request, employee_id)
        org_id = request.user.organization_id

        if not employee.user_id:
            return self.error("No account found for this employee.", 404)

        account_type = request.data.get("account_type")
        if account_type not in ("user", "manager"):
            return self.error(
                "The given data was invalid.", 422, errors={"account_type": ["Must be user or manager."]}
            )

        user = get_object_or_404(User, pk=employee.user_id)
        add_role_name = "Team Lead" if account_type == "manager" else "Employee"
        remove_role_name = "Employee" if account_type == "manager" else "Team Lead"

        remove_role = Role.objects.filter(organization_id=org_id, name=remove_role_name).first()
        if remove_role:
            UserRoleAssignment.objects.filter(user=user, role=remove_role).delete()

        add_role = Role.objects.filter(organization_id=org_id, name=add_role_name).first()
        if add_role:
            UserRoleAssignment.objects.get_or_create(user=user, role=add_role)

        return self.ok({"account_type": account_type}, "Account type updated.")


class EmployeeAccountResetPasswordAPIView(EnvelopeAPIView):
    def post(self, request, employee_id):
        employee = _get_employee(request, employee_id)
        if not employee.user_id:
            return self.error("No account found.", 404)

        plain_password = _random_password()
        user = get_object_or_404(User, pk=employee.user_id)
        user.set_password(plain_password)
        user.save(update_fields=["password", "updated_at"])

        return self.ok({"email": user.email, "password": plain_password}, "Password reset.")


class EmployeeAccountDeactivateAPIView(EnvelopeAPIView):
    def post(self, request, employee_id):
        employee = _get_employee(request, employee_id)
        if not employee.user_id:
            return self.error("No account found.", 404)
        User.objects.filter(pk=employee.user_id).update(is_active=False)
        return self.ok(None, "Account deactivated.")


class EmployeeAccountActivateAPIView(EnvelopeAPIView):
    def post(self, request, employee_id):
        employee = _get_employee(request, employee_id)
        if not employee.user_id:
            return self.error("No account found.", 404)
        User.objects.filter(pk=employee.user_id).update(is_active=True)
        return self.ok(None, "Account activated.")
