"""
DRF views for /api/v1/{job-postings,candidates,candidate-portal}* - ported
from Recruitment\\{JobPostingController,CandidateController,
CandidatePortalController}.php.
"""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import AllowAny

from apps.ai_billing import services as ai_credit_services
from apps.core.views import EnvelopeAPIView

from . import services
from .models import Candidate, CandidateStageLabel, JobPosting
from .serializers import CandidateSerializer, JobPostingSerializer


class JobPostingListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = JobPosting.objects.order_by("-id")
        return self.paginated_ok(request, qs, JobPostingSerializer)

    def post(self, request):
        data = request.data
        job = JobPosting.objects.create(
            organization_id=request.user.organization_id,
            title=data.get("title"),
            job_description=data.get("job_description"),
            department_id=data.get("department_id") or None,
            office_id=data.get("office_id") or None,
            openings=data.get("openings") or 1,
            status=data.get("status", "draft"),
        )
        return self.ok(JobPostingSerializer(job).data, "Job posting created", 201)


class JobPostingDetailAPIView(EnvelopeAPIView):
    def get(self, request, job_posting_id):
        job = get_object_or_404(JobPosting, pk=job_posting_id)
        return self.ok(JobPostingSerializer(job).data)

    def patch(self, request, job_posting_id):
        job = get_object_or_404(JobPosting, pk=job_posting_id)
        for field in ["title", "job_description", "status"]:
            if field in request.data:
                setattr(job, field, request.data[field])
        job.save()
        return self.ok(JobPostingSerializer(job).data, "Job posting updated")

    def delete(self, request, job_posting_id):
        job = get_object_or_404(JobPosting, pk=job_posting_id)
        job.delete()
        return self.ok(None, "Job posting deleted")


class CandidateListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = Candidate.objects.order_by("-id")
        return self.paginated_ok(request, qs, CandidateSerializer)

    def post(self, request):
        data = request.data
        if data.get("use_ai_parse") is True:
            ok = ai_credit_services.consume(
                request.user.organization_id, "resume_parse", ai_credit_services.COST_RESUME_PARSE
            )
            if not ok:
                return self.error("Insufficient Credits", 402)

        candidate = Candidate.objects.create(
            organization_id=request.user.organization_id,
            job_posting_id=data.get("job_posting_id"),
            full_name=data.get("full_name"),
            email=data.get("email"),
            phone=data.get("phone"),
            source=data.get("source", "portal"),
            cv_url=data.get("cv_url"),
            stage="applied",
            status="active",
        )
        return self.ok(CandidateSerializer(candidate).data, "Candidate created", 201)


class CandidateDetailAPIView(EnvelopeAPIView):
    def get(self, request, candidate_id):
        candidate = get_object_or_404(Candidate, pk=candidate_id)
        return self.ok(CandidateSerializer(candidate).data)

    def put(self, request, candidate_id):
        candidate = get_object_or_404(Candidate, pk=candidate_id)
        for field in ["stage", "status", "ai_score", "ai_rating"]:
            if field in request.data:
                setattr(candidate, field, request.data[field])
        candidate.save()
        return self.ok(CandidateSerializer(candidate).data, "Candidate updated")

    def delete(self, request, candidate_id):
        candidate = get_object_or_404(Candidate, pk=candidate_id)
        candidate.delete()
        return self.ok(None, "Candidate deleted")


class CandidateMoveStageAPIView(EnvelopeAPIView):
    def post(self, request, candidate_id):
        candidate = get_object_or_404(Candidate, pk=candidate_id)
        stage = request.data.get("stage")
        candidate.stage = stage

        visible_label = request.data.get("candidate_visible_label")
        if visible_label:
            candidate.candidate_visible_stage = visible_label
        else:
            mapping = CandidateStageLabel.objects.filter(internal_label=stage).first()
            candidate.candidate_visible_stage = mapping.external_label if mapping else stage
        candidate.save()
        return self.ok(CandidateSerializer(candidate).data, "Candidate stage updated")


class CandidateAcceptOfferAPIView(EnvelopeAPIView):
    def post(self, request, candidate_id):
        candidate = get_object_or_404(Candidate, pk=candidate_id)
        employee = services.accept_offer(candidate, request.user.organization_id)
        from apps.people.serializers import EmployeeSerializer

        return self.ok(EmployeeSerializer(employee).data, "Candidate converted to employee")


class LinkedinAuthUrlAPIView(EnvelopeAPIView):
    def get(self, request):
        job_posting_id = int(request.query_params.get("job_posting_id", 0))
        url = services.linkedin_auth_url(job_posting_id, request.user.organization_id)
        return self.ok({"auth_url": url})


class RequestMagicLinkAPIView(EnvelopeAPIView):
    def post(self, request):
        email = request.data.get("email")
        link = services.request_magic_link(request.user.organization_id, email)
        return self.ok({"magic_link": link}, "Magic link generated")


class StatusByMagicTokenAPIView(EnvelopeAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .models import CandidateAccount

        token = request.data.get("token")
        org_id = request.user.organization_id if request.user.is_authenticated else None

        qs = CandidateAccount.all_objects.filter(magic_token=token, magic_token_expires_at__gt=timezone.now())
        if org_id:
            qs = qs.filter(organization_id=org_id)
        account = qs.first()
        if not account:
            return self.error("Invalid or expired magic link token", 422)

        candidates = Candidate.all_objects.filter(email=account.email).values(
            "id", "job_posting_id", "stage", "status", "updated_at"
        )
        return self.ok(list(candidates))


class LinkedinApplyCallbackAPIView(EnvelopeAPIView):
    def post(self, request):
        code = request.data.get("code")
        state = request.data.get("state")
        candidate, error = services.linkedin_apply_callback(code, state, request.user.organization_id)
        if error:
            return self.error(error, 422)
        return self.ok(CandidateSerializer(candidate).data, "LinkedIn application submitted", 201)
