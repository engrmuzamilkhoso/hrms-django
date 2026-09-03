"""
Lets Django verify (and re-encode) the existing users.password values, which
were hashed by Laravel's Hash::make() - PHP bcrypt, `$2y$...` prefix. Python's
bcrypt library only recognizes `$2a$`/`$2b$`/`$2x$`; `$2y$` is
byte-for-byte compatible (both are the OpenBSD bcrypt variant, `$2y$` is
just PHP crypt()'s prefix for it), so we normalize the prefix before
delegating to bcrypt.checkpw(). This is what lets the seeded demo accounts
(orgadmin@demo.com etc, see creds.txt) log into Django completely unchanged.
"""

import bcrypt
from django.contrib.auth.hashers import BasePasswordHasher, mask_hash
from django.utils.translation import gettext_noop as _


def _normalize(encoded: str) -> bytes:
    # $2y$ (PHP) -> $2b$ (Python bcrypt) - same algorithm, different tag.
    if encoded.startswith("$2y$"):
        encoded = "$2b$" + encoded[4:]
    return encoded.encode("utf-8")


class LaravelBcryptPasswordHasher(BasePasswordHasher):
    algorithm = "laravel_bcrypt"
    rounds = 10

    def identify(self, encoded):
        return encoded.startswith(("$2y$", "$2a$", "$2b$", "$2x$"))

    def salt(self):
        return bcrypt.gensalt(self.rounds).decode("ascii")

    def encode(self, password, salt=None):
        password_bytes = password.encode("utf-8")[:72]
        salt_bytes = salt.encode("ascii") if salt else bcrypt.gensalt(self.rounds)
        return bcrypt.hashpw(password_bytes, salt_bytes).decode("ascii")

    def verify(self, password, encoded):
        password_bytes = password.encode("utf-8")[:72]
        try:
            return bcrypt.checkpw(password_bytes, _normalize(encoded))
        except ValueError:
            return False

    def safe_summary(self, encoded):
        return {
            _("algorithm"): self.algorithm,
            _("work factor"): encoded[4:6] if len(encoded) > 6 else "?",
            _("hash"): mask_hash(encoded),
        }

    def must_update(self, encoded):
        return False

    def harden_runtime(self, password, encoded):
        pass
