"""DRF view for /api/v1/employees/import - openpyxl/csv port of
EmployeeImportController.php@import. The source app's controller method also
had a template() method, but no route was ever registered for it in
routes/api.php (dead code) - not ported, matching plan's "fix only dead
code" (nothing to fix here, just nothing to port)."""

import csv
import io
from datetime import datetime

import openpyxl
from django.utils.dateparse import parse_date

from apps.core.permissions import HasRole
from apps.core.views import EnvelopeAPIView

from .models import Employee

ADMIN_OR_HR = HasRole.of(["Org Admin", "HR Manager"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024


def _parse_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if hasattr(value, "isoformat") and not isinstance(value, str):
        return value
    parsed = parse_date(str(value).strip())
    if parsed:
        return parsed
    for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date value: {value!r}")


def _read_rows(upload):
    name = (upload.name or "").lower()
    if name.endswith(".csv"):
        text = upload.read().decode("utf-8-sig", errors="replace")
        return list(csv.reader(io.StringIO(text)))

    workbook = openpyxl.load_workbook(upload, data_only=True)
    sheet = workbook.active
    return [list(row) for row in sheet.iter_rows(values_only=True)]


class EmployeeImportAPIView(EnvelopeAPIView):
    permission_classes = [ADMIN_OR_HR]

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return self.error("File is required", 422, errors={"file": ["File is required"]})
        if not upload.name.lower().endswith((".xlsx", ".xls", ".csv")):
            return self.error("File must be in Excel or CSV format", 422, errors={"file": ["File must be in Excel or CSV format"]})
        if upload.size > MAX_UPLOAD_BYTES:
            return self.error("File size cannot exceed 5MB", 422, errors={"file": ["File size cannot exceed 5MB"]})

        skip_duplicates = str(request.data.get("skip_duplicates", "")).lower() in ("1", "true", "on")
        org_id = request.user.organization_id

        try:
            rows = _read_rows(upload)
        except Exception as e:
            return self.error(f"Failed to parse file: {e}", 400)

        rows = rows[1:]  # skip header row

        imported, errors, duplicates = [], [], []

        for index, row in enumerate(rows):
            row = list(row) + [None] * (9 - len(row))
            code, name, email, phone, hire_date, office_id, department_id, designation, status = row[:9]

            if not code or not name or not email:
                continue

            try:
                existing = Employee.objects.filter(organization_id=org_id, employee_code=code).first()

                if existing:
                    if skip_duplicates:
                        duplicates.append({"row": index + 2, "code": code, "message": "Employee code already exists"})
                        continue
                    existing.full_name = name
                    existing.email = email
                    existing.phone = phone or None
                    existing.hire_date = _parse_date(hire_date) or existing.hire_date
                    existing.office_id = office_id or None
                    existing.department_id = department_id or None
                    existing.designation_text = designation or None
                    existing.employment_status = status or "active"
                    existing.save()
                    imported.append({"id": existing.id, "action": "updated"})
                else:
                    employee = Employee.objects.create(
                        organization_id=org_id,
                        employee_code=code,
                        full_name=name,
                        email=email,
                        phone=phone or None,
                        hire_date=_parse_date(hire_date),
                        office_id=office_id or None,
                        department_id=department_id or None,
                        designation_text=designation or None,
                        employment_status=status or "active",
                    )
                    imported.append({"id": employee.id, "action": "created"})
            except Exception as e:
                errors.append({"row": index + 2, "message": str(e)})

        return self.ok(
            {
                "imported_count": len(imported),
                "duplicate_count": len(duplicates),
                "error_count": len(errors),
                "imported": imported,
                "duplicates": duplicates,
                "errors": errors,
            },
            "Employee import completed",
            201,
        )
