"""Ported from People\\EmployeeController.php's private helpers."""

from django.db.models import Max

from .models import Employee, EmployeeReportingManager


def generate_employee_code(organization_id):
    base = Employee.all_objects.filter(organization_id=organization_id).aggregate(m=Max("id"))["m"] or 0
    seq = base + 1
    while True:
        code = f"EMP-{seq:04d}"
        if not Employee.all_objects.filter(employee_code=code).exists():
            return code
        seq += 1


def sync_reporting_managers(organization_id, employee_id, manager_ids):
    EmployeeReportingManager.all_objects.filter(employee_id=employee_id).delete()
    for order, manager_id in enumerate(manager_ids, start=1):
        EmployeeReportingManager.all_objects.create(
            organization_id=organization_id,
            employee_id=employee_id,
            manager_employee_id=int(manager_id),
            approval_order=order,
        )
