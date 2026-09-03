"""
Mirrors People\\{EmployeeController,DesignationController,DocumentController,
BankAccountController,EmergencyContactController,EmployeeEducationController,
EmployeeExperienceController,ProbationReviewController} models. Several
sub-resource tables had no Eloquent model in Laravel at all (raw
DB::table() only) - promoted to real models here per the plan.
"""

from django.db import models

from apps.core.models import TenantScopedModel
from apps.organization.models import Department, Office, Organization, Team


class Designation(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    title = models.CharField(max_length=120)
    grade = models.CharField(max_length=40, null=True, blank=True)
    base_salary = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="PKR")
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "designations"
        managed = True

    def __str__(self):
        return self.title


class Employee(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        db_constraint=False,
        null=True,
        blank=True,
        related_name="+",
    )
    office = models.ForeignKey(
        Office, on_delete=models.DO_NOTHING, db_column="office_id", db_constraint=False, null=True, blank=True
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.DO_NOTHING,
        db_column="department_id",
        db_constraint=False,
        null=True,
        blank=True,
    )
    team = models.ForeignKey(
        Team, on_delete=models.DO_NOTHING, db_column="team_id", db_constraint=False, null=True, blank=True
    )
    shift_id = models.BigIntegerField(null=True, blank=True)
    leave_policy_id = models.BigIntegerField(null=True, blank=True)
    reporting_manager = models.ForeignKey(
        "self",
        on_delete=models.DO_NOTHING,
        db_column="reporting_manager_id",
        db_constraint=False,
        null=True,
        blank=True,
        related_name="direct_reports",
    )
    employee_code = models.CharField(max_length=80)
    full_name = models.CharField(max_length=160)
    email = models.CharField(max_length=190)
    phone = models.CharField(max_length=50, null=True, blank=True)
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=30, null=True, blank=True)
    marital_status = models.CharField(max_length=30, null=True, blank=True)
    nationality = models.CharField(max_length=60, null=True, blank=True)
    national_id_no = models.CharField(max_length=80, null=True, blank=True)
    passport_no = models.CharField(max_length=80, null=True, blank=True)
    designation_text = models.CharField(max_length=120, null=True, blank=True, db_column="designation")
    current_designation = models.ForeignKey(
        Designation,
        on_delete=models.SET_NULL,
        db_column="designation_id",
        null=True,
        blank=True,
        related_name="employees",
    )
    contract_type = models.CharField(max_length=60, null=True, blank=True)
    employment_status = models.CharField(max_length=40, default="active")
    hire_date = models.DateField()
    probation_end_date = models.DateField(null=True, blank=True)
    confirmation_date = models.DateField(null=True, blank=True)
    exit_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employees"
        managed = True
        unique_together = (("organization", "employee_code"), ("organization", "email"))

    def __str__(self):
        return self.full_name


class EmployeeReportingManager(TenantScopedModel):
    """Multi-manager leave-approval chain (raw DB::table('employee_reporting_managers')
    in Laravel, no Eloquent model)."""

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, db_column="employee_id", related_name="+")
    manager_employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, db_column="manager_employee_id", related_name="+"
    )
    approval_order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_reporting_managers"
        managed = True
        unique_together = (("employee", "manager_employee"),)


class EmployeeDocument(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, db_column="employee_id", related_name="documents")
    document_type = models.CharField(max_length=80)
    document_number = models.CharField(max_length=120, null=True, blank=True)
    file_url = models.CharField(max_length=500, null=True, blank=True)
    issue_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, default="valid")
    notes = models.CharField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_documents"
        managed = True


class EmployeeBankAccount(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, db_column="employee_id", related_name="bank_accounts")
    bank_name = models.CharField(max_length=120)
    account_title = models.CharField(max_length=160)
    account_number = models.CharField(max_length=80)
    iban = models.CharField(max_length=34, null=True, blank=True)
    branch_code = models.CharField(max_length=30, null=True, blank=True)
    currency = models.CharField(max_length=3, default="PKR")
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_bank_accounts"
        managed = True


class EmployeeEmergencyContact(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, db_column="employee_id", related_name="emergency_contacts"
    )
    name = models.CharField(max_length=160)
    relationship = models.CharField(max_length=60)
    phone = models.CharField(max_length=50)
    email = models.CharField(max_length=190, null=True, blank=True)
    address = models.CharField(max_length=255, null=True, blank=True)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_emergency_contacts"
        managed = True


class EmployeeEducation(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, db_column="employee_id", related_name="education")
    degree = models.CharField(max_length=120)
    institution = models.CharField(max_length=180)
    field_of_study = models.CharField(max_length=120, null=True, blank=True)
    start_year = models.PositiveSmallIntegerField(null=True, blank=True)
    end_year = models.PositiveSmallIntegerField(null=True, blank=True)
    grade = models.CharField(max_length=40, null=True, blank=True)
    certificate_url = models.CharField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_education"
        managed = True


class EmployeeWorkExperience(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, db_column="employee_id", related_name="experience")
    company_name = models.CharField(max_length=180)
    job_title = models.CharField(max_length=120)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    responsibilities = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_work_experience"
        managed = True


class ProbationReview(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, db_column="employee_id")
    probation_end_date = models.DateField()
    status = models.CharField(max_length=30, default="pending")  # passed, extended, terminated
    extended_to_date = models.DateField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "probation_reviews"
        managed = True


class DocumentExpiryReminder(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    employee_document_id = models.BigIntegerField()
    days_before = models.PositiveIntegerField()  # 90, 60, 30, 7
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "document_expiry_reminders"
        managed = True
