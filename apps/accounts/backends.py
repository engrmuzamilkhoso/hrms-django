"""
Session auth backend. The actual multi-step login validation (password
check -> is_active check -> org-status check, each with Laravel's exact
error message) lives in apps.accounts.services.authenticate_login, mirroring
App\\Http\\Controllers\\Auth\\LoginController::login()'s explicit sequential
checks rather than Django's generic pass/fail authenticate() flow. This
backend exists mainly so SessionMiddleware can reload the user each request
via get_user(), and so django.contrib.auth.login() has a backend to record.
"""

from .models import User


class LaravelStyleBackend:
    def authenticate(self, request, email=None, password=None, **kwargs):
        from .services import authenticate_login

        if email is None or password is None:
            return None
        user, _error = authenticate_login(email, password)
        return user

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
