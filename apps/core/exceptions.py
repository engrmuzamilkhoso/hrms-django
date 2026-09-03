"""
Maps DRF exceptions onto the same JSON shapes Laravel produced by default,
since the frontend's apiRequest() (lib/api.ts) reads `.message` for the
toast/banner text and `.errors` (field -> [messages]) for inline form
errors on non-OK responses.
"""

from rest_framework import exceptions as drf_exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_default_handler


def envelope_exception_handler(exc, context):
    response = drf_default_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, drf_exceptions.ValidationError):
        detail = exc.detail
        if isinstance(detail, dict):
            errors = {
                field: [str(m) for m in (msgs if isinstance(msgs, list) else [msgs])]
                for field, msgs in detail.items()
            }
        else:
            errors = {"non_field_errors": [str(m) for m in (detail if isinstance(detail, list) else [detail])]}
        return Response(
            {"message": "The given data was invalid.", "errors": errors},
            status=response.status_code,
        )

    if isinstance(exc, drf_exceptions.NotAuthenticated) or isinstance(
        exc, drf_exceptions.AuthenticationFailed
    ):
        return Response({"message": "Unauthenticated."}, status=response.status_code)

    if isinstance(exc, drf_exceptions.PermissionDenied):
        return Response({"message": "This action is unauthorized."}, status=response.status_code)

    if isinstance(exc, drf_exceptions.NotFound):
        return Response({"message": "Not found."}, status=response.status_code)

    message = response.data.get("detail") if isinstance(response.data, dict) else str(response.data)
    return Response({"message": message or "Error"}, status=response.status_code)
