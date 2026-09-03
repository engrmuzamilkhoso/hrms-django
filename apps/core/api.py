from rest_framework.permissions import AllowAny
from rest_framework.serializers import ModelSerializer

from .models import Country, FeatureFlag
from .views import EnvelopeAPIView


class CountrySerializer(ModelSerializer):
    class Meta:
        model = Country
        fields = ["code", "name", "flag", "dial_code", "region", "is_active"]


class FeatureFlagSerializer(ModelSerializer):
    class Meta:
        model = FeatureFlag
        fields = ["id", "organization_id", "flag_key", "is_enabled", "rollout_notes", "created_at", "updated_at"]


class FeatureFlagListAPIView(EnvelopeAPIView):
    """Mirrors Settings\\FeatureFlagController@index. Note: FeatureFlag does
    NOT use the tenant-scoping trait in the source app (organization_id is
    nullable/global-or-per-org) - preserved as-is, not silently scoped."""

    def get(self, request):
        qs = FeatureFlag.objects.order_by("-id")
        return self.paginated_ok(request, qs, FeatureFlagSerializer, default_per_page=50)


class FeatureFlagToggleAPIView(EnvelopeAPIView):
    def post(self, request, flag_key):
        flag, _ = FeatureFlag.objects.update_or_create(
            organization_id=request.user.organization_id, flag_key=flag_key,
            defaults=dict(
                is_enabled=request.data["is_enabled"], rollout_notes=request.data.get("rollout_notes")
            ),
        )
        return self.ok(FeatureFlagSerializer(flag).data, "Feature flag updated")


class CountryListAPIView(EnvelopeAPIView):
    """Mirrors System\\CountryController@index - public, no auth, sits above
    the tenant/auth middleware groups (routes/api.php)."""

    permission_classes = [AllowAny]

    def get(self, request):
        countries = Country.objects.filter(is_active=True).order_by("name")
        return self.ok(CountrySerializer(countries, many=True).data)


class StubAPIView(EnvelopeAPIView):
    """
    Direct port of System\\StubController.php - unimplemented placeholder
    endpoints (interviews CRUD, cv-parse, cv-score, payroll payslip
    list/download) in the source app too. Kept as the same stubs rather than
    built out for real, matching "preserve existing functionality without
    scope creep" (see plan).
    """

    module = None
    stub_action = None

    def get(self, request, id=None):
        if id is not None:
            return self.ok({"id": id}, f"{self.module} detail endpoint scaffolded")
        return self.ok([], f"{self.module} list endpoint scaffolded")

    def post(self, request, id=None):
        if self.stub_action:
            return self.ok(
                {"action": self.stub_action, "payload": request.data}, f"{self.module} action endpoint scaffolded"
            )
        return self.ok(request.data, f"{self.module} create endpoint scaffolded", 201)

    def put(self, request, id=None):
        return self.ok({"id": id, "payload": request.data}, f"{self.module} update endpoint scaffolded")

    def delete(self, request, id=None):
        return self.ok(None, f"{self.module} delete endpoint scaffolded")
