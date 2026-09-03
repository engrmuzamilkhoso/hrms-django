from rest_framework import serializers

from .models import Candidate, JobPosting


class JobPostingSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobPosting
        fields = [
            "id", "organization_id", "department_id", "office_id", "title", "job_description",
            "skills_text", "openings", "status", "published_at", "created_at", "updated_at",
        ]


class CandidateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = [
            "id", "organization_id", "job_posting_id", "full_name", "email", "phone", "linkedin_url",
            "source", "cv_url", "profile_json", "ai_score", "ai_rating", "stage",
            "candidate_visible_stage", "status", "created_at", "updated_at",
        ]
