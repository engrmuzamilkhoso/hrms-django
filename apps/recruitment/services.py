"""Ported from Recruitment\\CandidatePortalController.php + CandidateController::acceptOffer()."""

import base64
import hashlib
import json
import secrets
import string
from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone

from .models import CandidateAccount


def linkedin_auth_url(job_posting_id, organization_id):
    client_id = getattr(settings, "LINKEDIN_CLIENT_ID", "sample_linkedin_client_id")
    redirect_uri = getattr(
        settings, "LINKEDIN_REDIRECT_URI", "http://localhost:8000/api/v1/candidate-portal/linkedin/callback"
    )
    nonce = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))
    state = base64.b64encode(
        json.dumps({"job_posting_id": job_posting_id, "org_id": organization_id, "nonce": nonce}).encode()
    ).decode()

    from urllib.parse import urlencode

    params = urlencode(
        {
            "response_type": "code", "client_id": client_id, "redirect_uri": redirect_uri,
            "state": state, "scope": "r_liteprofile r_emailaddress",
        }
    )
    return f"https://www.linkedin.com/oauth/v2/authorization?{params}"


def request_magic_link(organization_id, email):
    token = hashlib.sha256(f"{email}|{secrets.token_urlsafe(20)}".encode()).hexdigest()

    CandidateAccount.all_objects.update_or_create(
        organization_id=organization_id, email=email,
        defaults={"magic_token": token, "magic_token_expires_at": timezone.now() + timedelta(minutes=20)},
    )

    base_url = getattr(settings, "FRONTEND_CANDIDATE_PORTAL_URL", "http://localhost:3000/candidate").rstrip("/")
    return f"{base_url}?token={token}"


def linkedin_apply_callback(code, state, fallback_org_id):
    decoded_state = json.loads(base64.b64decode(state))
    org_id = decoded_state.get("org_id", fallback_org_id)
    job_posting_id = decoded_state.get("job_posting_id", 0)

    redirect_uri = getattr(
        settings, "LINKEDIN_REDIRECT_URI", "http://localhost:8000/api/v1/candidate-portal/linkedin/callback"
    )
    client_id = getattr(settings, "LINKEDIN_CLIENT_ID", "sample_linkedin_client_id")
    client_secret = getattr(settings, "LINKEDIN_CLIENT_SECRET", "sample_linkedin_client_secret")

    token_resp = requests.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        data={
            "grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri,
            "client_id": client_id, "client_secret": client_secret,
        },
    ).json()
    access_token = token_resp.get("access_token")
    if not access_token:
        return None, "LinkedIn token exchange failed"

    headers = {"Authorization": f"Bearer {access_token}"}
    profile = requests.get("https://api.linkedin.com/v2/me", headers=headers).json()
    email_data = requests.get(
        "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))", headers=headers
    ).json()

    try:
        email = email_data["elements"][0]["handle~"]["emailAddress"]
    except (KeyError, IndexError):
        return None, "LinkedIn email not available"

    full_name = f"{profile.get('localizedFirstName', '')} {profile.get('localizedLastName', '')}".strip()
    headline = (profile.get("headline") or {}).get("localized", {}).get("en_US")
    linkedin_url = f"https://www.linkedin.com/in/{profile.get('id', 'profile')}"

    from .models import Candidate

    candidate = Candidate.objects.create(
        organization_id=org_id, job_posting_id=job_posting_id, full_name=full_name or "LinkedIn Candidate",
        email=email, linkedin_url=linkedin_url, source="linkedin", profile_json={"headline": headline},
        stage="applied", status="active",
    )

    CandidateAccount.all_objects.update_or_create(
        organization_id=org_id, email=email, defaults={"full_name": full_name}
    )

    return candidate, None


def accept_offer(candidate, organization_id):
    from apps.accounts.models import User
    from apps.people.models import Employee

    employee = Employee.objects.create(
        organization_id=organization_id,
        employee_code=f"EMP-{secrets.token_hex(3).upper()}",
        full_name=candidate.full_name,
        email=candidate.email,
        phone=candidate.phone,
        hire_date=timezone.localdate(),
        employment_status="active",
    )

    candidate.status = "hired"
    candidate.stage = "hired"
    candidate.save()

    User.objects.create_user(
        organization_id=organization_id, employee_id=employee.id, name=employee.full_name, email=employee.email,
        password=secrets.token_urlsafe(9), is_active=True,
    )
    return employee
