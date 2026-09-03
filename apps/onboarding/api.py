from django.shortcuts import get_object_or_404

from apps.core.views import EnvelopeAPIView

from .models import OnboardingTask
from .serializers import OnboardingTaskSerializer


class OnboardingTaskListCreateAPIView(EnvelopeAPIView):
    def get(self, request):
        qs = OnboardingTask.objects.filter(organization_id=request.user.organization_id).order_by("-id")
        return self.paginated_ok(request, qs, OnboardingTaskSerializer)

    def post(self, request):
        data = request.data
        task = OnboardingTask.objects.create(
            organization_id=request.user.organization_id,
            employee_id=data["employee_id"],
            title=data["title"],
            assigned_to_user_id=data.get("assigned_to_user_id") or None,
            due_date=data.get("due_date") or None,
            status=data.get("status", "pending"),
        )
        return self.ok({"id": task.id}, "Onboarding task created", 201)


class OnboardingTaskDetailAPIView(EnvelopeAPIView):
    """No update route existed in the source app (routes/api.php only wired
    index/store) - the "Mark Done" button 404'd on every click. Added since
    there's no real behavior to preserve, matching the plan's carve-out for
    dead/broken actions (e.g. Controller::error())."""

    def patch(self, request, task_id):
        task = get_object_or_404(OnboardingTask, pk=task_id, organization_id=request.user.organization_id)
        for field in ["title", "status", "assigned_to_user_id", "due_date"]:
            if field in request.data:
                setattr(task, field, request.data[field])
        task.save()
        return self.ok(OnboardingTaskSerializer(task).data, "Onboarding task updated")
