"""
Reproduces Laravel's LengthAwarePaginator::toArray() shape, since the React
frontend (lib/api.ts -> every list page) reads `.data`, `.current_page`,
`.last_page`, `.total` etc. directly off the unwrapped paginator object
(e.g. app/dashboard/employees/page.tsx). Used by views via `paginate()`
below rather than a DRF pagination class, since Laravel wraps this dict a
second time inside the `{message, data}` envelope explicitly per-action
(see apps.core.views.EnvelopeAPIView.ok), not via a global renderer.
"""

from django.core.paginator import Paginator


def paginate(request, queryset, serializer_class, *, default_per_page=20, context=None):
    per_page = int(request.query_params.get("per_page", default_per_page) or default_per_page)
    per_page = max(1, min(per_page, 500))
    page_number = int(request.query_params.get("page", 1) or 1)

    paginator = Paginator(queryset, per_page)
    page = paginator.page(min(max(page_number, 1), paginator.num_pages or 1))

    serializer = serializer_class(page.object_list, many=True, context=context or {"request": request})

    base_path = request.build_absolute_uri(request.path)
    from_ = (page.number - 1) * per_page + 1 if paginator.count else None
    to = from_ + len(page.object_list) - 1 if from_ else None

    return {
        "current_page": page.number,
        "data": serializer.data,
        "first_page_url": f"{base_path}?page=1",
        "from": from_,
        "last_page": paginator.num_pages,
        "last_page_url": f"{base_path}?page={paginator.num_pages}",
        "next_page_url": f"{base_path}?page={page.next_page_number()}" if page.has_next() else None,
        "path": base_path,
        "per_page": per_page,
        "prev_page_url": f"{base_path}?page={page.previous_page_number()}" if page.has_previous() else None,
        "to": to,
        "total": paginator.count,
    }
