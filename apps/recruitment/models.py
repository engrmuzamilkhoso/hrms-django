"""Mirrors Recruitment\\{JobPostingController,CandidateController,CandidatePortalController} models."""

from django.db import models

from apps.core.models import TenantScopedModel
from apps.organization.models import Department, Office, Organization


class JobPosting(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, db_column="department_id", null=True, blank=True
    )
    office = models.ForeignKey(Office, on_delete=models.SET_NULL, db_column="office_id", null=True, blank=True)
    title = models.CharField(max_length=180)
    job_description = models.TextField()
    skills_text = models.TextField(null=True, blank=True)
    openings = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=30, default="draft")
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "job_postings"
        managed = True

    def __str__(self):
        return self.title


class Candidate(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    job_posting = models.ForeignKey(JobPosting, on_delete=models.CASCADE, db_column="job_posting_id")
    full_name = models.CharField(max_length=160)
    email = models.CharField(max_length=190)
    phone = models.CharField(max_length=60, null=True, blank=True)
    linkedin_url = models.CharField(max_length=255, null=True, blank=True)
    source = models.CharField(max_length=40, default="portal")
    cv_url = models.CharField(max_length=500, null=True, blank=True)
    profile_json = models.JSONField(null=True, blank=True)
    ai_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    ai_rating = models.CharField(max_length=30, null=True, blank=True)
    stage = models.CharField(max_length=60, default="applied")
    candidate_visible_stage = models.CharField(max_length=120, null=True, blank=True)
    status = models.CharField(max_length=30, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "candidates"
        managed = True


class CandidateAccount(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    email = models.CharField(max_length=190)
    full_name = models.CharField(max_length=160, null=True, blank=True)
    linkedin_sub = models.CharField(max_length=120, null=True, blank=True)
    magic_token = models.CharField(max_length=120, null=True, blank=True)
    magic_token_expires_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=30, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "candidate_accounts"
        managed = True
        unique_together = (("organization", "email"),)


class CandidateStageLabel(TenantScopedModel):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, db_column="organization_id")
    internal_label = models.CharField(max_length=120)
    external_label = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "candidate_stage_labels"
        managed = True
