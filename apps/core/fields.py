"""
Laravel's `$table->id()` always creates `bigint UNSIGNED AUTO_INCREMENT`
primary keys, but Django's built-in BigAutoField generates plain (signed)
`bigint AUTO_INCREMENT` - a mismatch that breaks any real foreign key MySQL
tries to create against one of these columns (signed/unsigned FK type
mismatch is a hard MySQL error). Used as DEFAULT_AUTO_FIELD project-wide so
every model's auto id column matches the existing schema exactly, and so
Django-internal FKs pointing at our models (django_admin_log.user_id,
authtoken_token.user_id, ...) automatically inherit the correct type.
"""

from django.db.models import BigAutoField


class UnsignedBigAutoField(BigAutoField):
    def db_type(self, connection):
        if connection.vendor == "mysql":
            return "bigint UNSIGNED AUTO_INCREMENT"
        return super().db_type(connection)

    def rel_db_type(self, connection):
        if connection.vendor == "mysql":
            return "bigint UNSIGNED"
        return super().rel_db_type(connection)
