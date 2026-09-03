"""
Session auth backend. The actual multi-step login validation (password
check -> is_active check -> org-status check, each with Laravel's exact
error message) lives in apps.accounts.services.authenticate_login, mirroring
App\\Http\\Controllers\\Auth\\LoginController::login()'s explicit sequential
checks rather than Django's generic pass/fail authenticate() flow. This
backend exists mainly so SessionMiddleware can reload the user each request
via get_user(), and so django.contrib.auth.login() has a backend to record.
"""

import sys

from .models import User


def _dbg(msg):
    print(f"[LOGIN-DEBUG] LaravelStyleBackend: {msg}", file=sys.stderr, flush=True)


class LaravelStyleBackend:
    def authenticate(self, request, email=None, password=None, **kwargs):
        from .services import authenticate_login

        if email is None or password is None:
            return None
        user, _error = authenticate_login(email, password)
        return user

    def get_user(self, user_id):
        _dbg(f"get_user: reloading user_id={user_id} from session")
        try:
            user = User.objects.get(pk=user_id)
            _dbg(f"get_user: found {user!r}")
            return user
        except User.DoesNotExist:
            _dbg(f"get_user: no User with pk={user_id}")
            return None
        except Exception:
            import traceback

            _dbg("get_user: UNHANDLED EXCEPTION - traceback follows")
            traceback.print_exc(file=sys.stderr)
            sys.stderr.flush()
            raise
