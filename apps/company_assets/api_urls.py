from django.urls import path

from . import api

urlpatterns = [
    path("assets", api.AssetListCreateAPIView.as_view()),
    path("assets/<int:asset_id>", api.AssetDetailAPIView.as_view()),
    path("assets/<int:asset_id>/assign", api.AssetAssignAPIView.as_view()),
    path("assets/<int:asset_id>/return", api.AssetReturnAPIView.as_view()),
]
