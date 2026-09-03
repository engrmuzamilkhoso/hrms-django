"""
DRF views for employee sub-resources - ported from People\\{BankAccountController,
EmergencyContactController,EmployeeEducationController,EmployeeExperienceController,
DocumentController,ProbationReviewController}.php. These had no Eloquent model
in Laravel (raw DB::table() only for the first four) - promoted to real
models (see apps.people.models), same behavior.

Note: ProbationReviewController::outcome()/store() in the source app write to
columns that don't exist on the real `probation_reviews` table (`outcome`,
`extended_to`, `reviewed_by_user_id` vs the real `status`/`extended_to_date`,
no reviewed-by column at all) - a guaranteed SQL error today. Implemented
here against the real schema instead (see plan's "fix only dead code").
"""

from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.core.views import EnvelopeAPIView

from .models import (
    Employee,
    EmployeeBankAccount,
    EmployeeDocument,
    EmployeeEducation,
    EmployeeEmergencyContact,
    EmployeeWorkExperience,
    ProbationReview,
)
from .serializers import (
    EmployeeBankAccountSerializer,
    EmployeeDocumentSerializer,
    EmployeeEducationSerializer,
    EmployeeEmergencyContactSerializer,
    EmployeeWorkExperienceSerializer,
    ProbationReviewSerializer,
)


class BankAccountListCreateAPIView(EnvelopeAPIView):
    def get(self, request, employee_id):
        qs = EmployeeBankAccount.objects.filter(
            organization_id=request.user.organization_id, employee_id=employee_id
        ).order_by("-is_primary")
        return self.ok(EmployeeBankAccountSerializer(qs, many=True).data, "Bank accounts retrieved")

    def post(self, request, employee_id):
        org_id = request.user.organization_id
        data = request.data
        if data.get("is_primary"):
            EmployeeBankAccount.objects.filter(organization_id=org_id, employee_id=employee_id).update(is_primary=False)

        account = EmployeeBankAccount.objects.create(
            organization_id=org_id, employee_id=employee_id,
            bank_name=data["bank_name"], account_title=data["account_title"], account_number=data["account_number"],
            iban=data.get("iban"), branch_code=data.get("branch_code"), currency=data.get("currency", "PKR"),
            is_primary=data.get("is_primary", False),
        )
        return self.ok(EmployeeBankAccountSerializer(account).data, "Bank account added", 201)


class BankAccountDetailAPIView(EnvelopeAPIView):
    def put(self, request, employee_id, account_id):
        org_id = request.user.organization_id
        data = request.data
        if data.get("is_primary"):
            EmployeeBankAccount.objects.filter(organization_id=org_id, employee_id=employee_id).update(is_primary=False)
        account = get_object_or_404(EmployeeBankAccount, pk=account_id, organization_id=org_id)
        for field in ["bank_name", "account_title", "account_number", "iban", "branch_code", "currency", "is_primary"]:
            if field in data:
                setattr(account, field, data[field])
        account.save()
        return self.ok(EmployeeBankAccountSerializer(account).data, "Bank account updated")

    def delete(self, request, employee_id, account_id):
        EmployeeBankAccount.objects.filter(pk=account_id, organization_id=request.user.organization_id).delete()
        return self.ok(None, "Bank account deleted")


class EmergencyContactListCreateAPIView(EnvelopeAPIView):
    def get(self, request, employee_id):
        qs = EmployeeEmergencyContact.objects.filter(
            organization_id=request.user.organization_id, employee_id=employee_id
        ).order_by("-is_primary")
        return self.ok(EmployeeEmergencyContactSerializer(qs, many=True).data, "Emergency contacts retrieved")

    def post(self, request, employee_id):
        org_id = request.user.organization_id
        data = request.data
        if data.get("is_primary"):
            EmployeeEmergencyContact.objects.filter(organization_id=org_id, employee_id=employee_id).update(is_primary=False)

        contact = EmployeeEmergencyContact.objects.create(
            organization_id=org_id, employee_id=employee_id,
            name=data["name"], relationship=data["relationship"], phone=data["phone"],
            email=data.get("email"), address=data.get("address"), is_primary=data.get("is_primary", False),
        )
        return self.ok(EmployeeEmergencyContactSerializer(contact).data, "Emergency contact added", 201)


class EmergencyContactDetailAPIView(EnvelopeAPIView):
    def put(self, request, employee_id, contact_id):
        org_id = request.user.organization_id
        data = request.data
        if data.get("is_primary"):
            EmployeeEmergencyContact.objects.filter(organization_id=org_id, employee_id=employee_id).update(is_primary=False)
        contact = get_object_or_404(EmployeeEmergencyContact, pk=contact_id, organization_id=org_id)
        for field in ["name", "relationship", "phone", "email", "address", "is_primary"]:
            if field in data:
                setattr(contact, field, data[field])
        contact.save()
        return self.ok(EmployeeEmergencyContactSerializer(contact).data, "Emergency contact updated")

    def delete(self, request, employee_id, contact_id):
        EmployeeEmergencyContact.objects.filter(pk=contact_id, organization_id=request.user.organization_id).delete()
        return self.ok(None, "Emergency contact deleted")


class EducationListCreateAPIView(EnvelopeAPIView):
    def get(self, request, employee_id):
        qs = EmployeeEducation.objects.filter(
            organization_id=request.user.organization_id, employee_id=employee_id
        ).order_by("-end_year")
        return self.ok(EmployeeEducationSerializer(qs, many=True).data, "Education records retrieved")

    def post(self, request, employee_id):
        data = request.data
        record = EmployeeEducation.objects.create(
            organization_id=request.user.organization_id, employee_id=employee_id,
            degree=data["degree"], institution=data["institution"], field_of_study=data.get("field_of_study"),
            start_year=data.get("start_year") or None, end_year=data.get("end_year") or None,
            grade=data.get("grade"), certificate_url=data.get("certificate_url"),
        )
        return self.ok(EmployeeEducationSerializer(record).data, "Education record added", 201)


class EducationDetailAPIView(EnvelopeAPIView):
    def put(self, request, employee_id, education_id):
        record = get_object_or_404(EmployeeEducation, pk=education_id, organization_id=request.user.organization_id)
        for field in ["degree", "institution", "field_of_study", "start_year", "end_year", "grade", "certificate_url"]:
            if field in request.data:
                setattr(record, field, request.data[field])
        record.save()
        return self.ok(EmployeeEducationSerializer(record).data, "Education record updated")

    def delete(self, request, employee_id, education_id):
        EmployeeEducation.objects.filter(pk=education_id, organization_id=request.user.organization_id).delete()
        return self.ok(None, "Education record deleted")


class ExperienceListCreateAPIView(EnvelopeAPIView):
    def get(self, request, employee_id):
        qs = EmployeeWorkExperience.objects.filter(
            organization_id=request.user.organization_id, employee_id=employee_id
        ).order_by("-start_date")
        return self.ok(EmployeeWorkExperienceSerializer(qs, many=True).data, "Work experience retrieved")

    def post(self, request, employee_id):
        data = request.data
        record = EmployeeWorkExperience.objects.create(
            organization_id=request.user.organization_id, employee_id=employee_id,
            company_name=data["company_name"], job_title=data["job_title"], start_date=data["start_date"],
            end_date=data.get("end_date") or None, is_current=data.get("is_current", False),
            responsibilities=data.get("responsibilities"),
        )
        return self.ok(EmployeeWorkExperienceSerializer(record).data, "Experience added", 201)


class ExperienceDetailAPIView(EnvelopeAPIView):
    def put(self, request, employee_id, experience_id):
        record = get_object_or_404(EmployeeWorkExperience, pk=experience_id, organization_id=request.user.organization_id)
        for field in ["company_name", "job_title", "start_date", "end_date", "is_current", "responsibilities"]:
            if field in request.data:
                setattr(record, field, request.data[field])
        record.save()
        return self.ok(EmployeeWorkExperienceSerializer(record).data, "Experience updated")

    def delete(self, request, employee_id, experience_id):
        EmployeeWorkExperience.objects.filter(pk=experience_id, organization_id=request.user.organization_id).delete()
        return self.ok(None, "Experience deleted")


class DocumentListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = EmployeeDocument.objects.filter(organization_id=request.user.organization_id).select_related(
            "employee"
        ).order_by("expiry_date")
        employee_id = request.query_params.get("employee_id")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        document_type = request.query_params.get("document_type")
        if document_type:
            qs = qs.filter(document_type=document_type)
        return self.paginated_ok(request, qs, EmployeeDocumentSerializer, "Documents retrieved")

    def post(self, request):
        data = request.data
        uploaded_file = request.FILES.get("file")
        file_url = None
        if uploaded_file:
            from django.core.files.storage import default_storage

            import uuid

            ext = uploaded_file.name.rsplit(".", 1)[-1] if "." in uploaded_file.name else ""
            filename = f"documents/{uuid.uuid4().hex}.{ext}" if ext else f"documents/{uuid.uuid4().hex}"
            file_url = default_storage.save(filename, uploaded_file)

        document = EmployeeDocument.objects.create(
            organization_id=request.user.organization_id,
            employee_id=data.get("employee_id"),
            document_type=data.get("document_type"),
            document_number=data.get("document_number"),
            issue_date=data.get("issue_date") or None,
            expiry_date=data.get("expiry_date") or None,
            file_url=file_url,
            notes=data.get("notes"),
        )
        return self.ok(EmployeeDocumentSerializer(document).data, "Document uploaded successfully", 201)


class DocumentDetailAPIView(EnvelopeAPIView):
    def get(self, request, document_id):
        document = get_object_or_404(
            EmployeeDocument.objects.select_related("employee"), pk=document_id, organization_id=request.user.organization_id
        )
        return self.ok(EmployeeDocumentSerializer(document).data, "Document retrieved")

    def delete(self, request, document_id):
        document = get_object_or_404(EmployeeDocument, pk=document_id, organization_id=request.user.organization_id)
        if document.file_url:
            from django.core.files.storage import default_storage

            if default_storage.exists(document.file_url):
                default_storage.delete(document.file_url)
        document.delete()
        return self.ok(None, "Document deleted successfully")


class DocumentExpiringSoonAPIView(EnvelopeAPIView):
    def get(self, request):
        today = timezone.localdate()
        rows = (
            EmployeeDocument.objects.filter(
                organization_id=request.user.organization_id, expiry_date__gte=today,
                expiry_date__lte=today + timezone.timedelta(days=30),
            )
            .select_related("employee")
            .order_by("expiry_date")
        )
        mapped = []
        for r in rows:
            days = (r.expiry_date - today).days
            status = "Expired" if days < 0 else ("Expiring Soon" if days <= 30 else "Valid")
            mapped.append(
                {
                    "id": r.id, "employee_id": r.employee_id,
                    "employee_name": r.employee.full_name if r.employee else None,
                    "document_type": r.document_type, "expiry_date": r.expiry_date,
                    "days_until_expiry": days, "status": status,
                }
            )
        return self.ok(mapped, "Expiring documents retrieved")


class ProbationReviewListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = ProbationReview.objects.filter(organization_id=request.user.organization_id).select_related(
            "employee"
        ).order_by("probation_end_date")
        rows = [
            {
                **ProbationReviewSerializer(r).data,
                "employee_name": r.employee.full_name,
                "employee_code": r.employee.employee_code,
                "designation": r.employee.designation_text,
            }
            for r in qs
        ]
        return self.ok(rows, "Probation reviews retrieved")

    def post(self, request):
        data = request.data
        review = ProbationReview.objects.create(
            organization_id=request.user.organization_id, employee_id=data["employee_id"],
            probation_end_date=data["probation_end_date"], notes=data.get("notes"), status="pending",
        )
        return self.ok(ProbationReviewSerializer(review).data, "Probation review created", 201)


class ProbationReviewOutcomeAPIView(EnvelopeAPIView):
    def post(self, request, review_id):
        org_id = request.user.organization_id
        review = get_object_or_404(ProbationReview, pk=review_id, organization_id=org_id)
        data = request.data

        review.status = data["outcome"]
        review.extended_to_date = data.get("extended_to") or None
        review.notes = data.get("notes")
        review.save()

        if data["outcome"] == "passed":
            Employee.objects.filter(organization_id=org_id, pk=review.employee_id).update(
                confirmation_date=timezone.localdate()
            )

        return self.ok(ProbationReviewSerializer(review).data, "Probation outcome recorded")


class ProbationReviewUpcomingAPIView(EnvelopeAPIView):
    def get(self, request):
        org_id = request.user.organization_id
        cutoff = timezone.localdate() + timezone.timedelta(days=30)
        rows = Employee.objects.filter(
            organization_id=org_id, employment_status="active", probation_end_date__isnull=False,
            probation_end_date__lte=cutoff, confirmation_date__isnull=True,
        ).order_by("probation_end_date")

        today = timezone.localdate()
        result = [
            {
                "id": e.id, "full_name": e.full_name, "employee_code": e.employee_code,
                "designation": e.designation_text, "probation_end_date": e.probation_end_date,
                "hire_date": e.hire_date, "days_remaining": (e.probation_end_date - today).days,
            }
            for e in rows
        ]
        return self.ok(result, "Upcoming probation reviews")
