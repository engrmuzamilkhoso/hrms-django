"""
DRF views for /api/v1/assets* - ported from Assets\\AssetController.php.
Note: assign()/returnAsset() in the source app set $asset->assigned_at /
->returned_at, columns that don't exist on the real `assets` table (would
crash with a real SQL error) - implemented here against the actual schema
(assigned_to_employee_id + condition_status only) instead, see plan's
"fix only dead code".
"""

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from apps.core.views import EnvelopeAPIView

from .models import Asset
from .serializers import AssetSerializer


def _check_org(request, asset):
    if request.user.organization_id != asset.organization_id:
        raise PermissionDenied("Forbidden")


class AssetListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = Asset.objects.filter(organization_id=request.user.organization_id).order_by("-id")
        employee_id = request.query_params.get("employee_id")
        if employee_id:
            qs = qs.filter(assigned_to_employee_id=employee_id)
        if request.query_params.get("unassigned"):
            qs = qs.filter(assigned_to_employee_id__isnull=True)
        return self.paginated_ok(request, qs, AssetSerializer)

    def post(self, request):
        data = request.data
        asset = Asset.objects.create(
            organization_id=request.user.organization_id,
            asset_code=data["asset_code"],
            category=data["category"],
            name=data["name"],
            serial_number=data.get("serial_number"),
            purchase_date=data.get("purchase_date"),
            cost=data.get("cost"),
            condition_status=data.get("condition_status", "good"),
            assigned_to_employee_id=data.get("assigned_to_employee_id") or None,
        )
        return self.ok(AssetSerializer(asset).data, "Asset created", 201)


class AssetDetailAPIView(EnvelopeAPIView):
    def get(self, request, asset_id):
        asset = get_object_or_404(Asset, pk=asset_id)
        _check_org(request, asset)
        return self.ok(AssetSerializer(asset).data)

    def patch(self, request, asset_id):
        asset = get_object_or_404(Asset, pk=asset_id)
        _check_org(request, asset)
        for field in [
            "asset_code", "category", "name", "serial_number", "purchase_date", "cost",
            "condition_status", "assigned_to_employee_id",
        ]:
            if field in request.data:
                setattr(asset, field, request.data[field])
        asset.save()
        return self.ok(AssetSerializer(asset).data, "Asset updated")

    def delete(self, request, asset_id):
        asset = get_object_or_404(Asset, pk=asset_id)
        _check_org(request, asset)
        asset.delete()
        return self.ok(None, "Asset deleted")


class AssetAssignAPIView(EnvelopeAPIView):
    def post(self, request, asset_id):
        asset = get_object_or_404(Asset, pk=asset_id)
        _check_org(request, asset)
        asset.assigned_to_employee_id = request.data["employee_id"]
        asset.save()
        return self.ok(AssetSerializer(asset).data, "Asset assigned")


class AssetReturnAPIView(EnvelopeAPIView):
    def post(self, request, asset_id):
        asset = get_object_or_404(Asset, pk=asset_id)
        _check_org(request, asset)
        asset.assigned_to_employee_id = None
        if request.data.get("condition_status"):
            asset.condition_status = request.data["condition_status"]
        asset.save()
        return self.ok(AssetSerializer(asset).data, "Asset returned")
