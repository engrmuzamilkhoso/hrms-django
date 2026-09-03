from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_super_admin", True)
        extra_fields.setdefault("is_active", True)
        return self.create_user(email, password, **extra_fields)

    def get_by_natural_key(self, email):
        # Laravel's login() does User::where('email', ...)->first() - email
        # is only unique per-organization, not globally (see seed data:
        # admin@techcorp.test exists under two different orgs). Mirror that
        # "first match wins" behavior rather than assuming global uniqueness.
        return self.filter(**{f"{self.model.USERNAME_FIELD}": email}).order_by("id").first()
