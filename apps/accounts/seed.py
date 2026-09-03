"""
Direct port of app/Services/SeedDataService.php - seeds default office,
department, leave type, shift, and salary structure/component for a newly
registered organization. Imports are deferred since this touches models
from apps built later in the migration (leave/attendance/payroll).
"""

from django.utils import timezone

from apps.organization.models import Department, Office


def seed_data_for_organization(organization_id):
    office, _ = Office.objects.get_or_create(
        organization_id=organization_id,
        name="Sample Head Office",
        defaults={"country_code": "PK", "city": "Karachi", "is_default": True},
    )

    Department.objects.get_or_create(
        organization_id=organization_id,
        name="Sample Department",
        defaults={"office_id": office.id},
    )

    from apps.leave.models import LeaveType

    LeaveType.objects.get_or_create(
        organization_id=organization_id,
        name="Sample Annual Leave",
        defaults={"annual_quota": 14, "carry_forward_enabled": False},
    )

    from apps.attendance.models import Shift

    Shift.objects.get_or_create(
        organization_id=organization_id,
        name="Sample Morning Shift",
        defaults=dict(
            office_id=office.id,
            start_time="09:00:00",
            end_time="18:00:00",
            grace_minutes=10,
            min_hours=8,
            overtime_after_hours=8,
            overtime_multiplier=1.5,
        ),
    )

    from apps.payroll.models import SalaryComponent, SalaryStructure

    structure, _ = SalaryStructure.objects.get_or_create(
        organization_id=organization_id,
        name="Sample Salary Structure",
        defaults={"is_default": True, "effective_from": timezone.localdate()},
    )

    SalaryComponent.objects.get_or_create(
        organization_id=organization_id,
        salary_structure_id=structure.id,
        component_name="Basic Salary",
        defaults=dict(
            component_type="earning",
            tax_treatment="taxable",
            calc_method="fixed",
            default_amount=50000,
        ),
    )
