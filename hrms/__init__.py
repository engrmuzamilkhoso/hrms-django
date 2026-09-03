import sys

import pymysql

pymysql.install_as_MySQLdb()

# Windows' console defaults stdout/stderr to the system codepage (cp1252),
# which can't encode characters used in email templates (e.g. the OTP
# email's stopwatch emoji) - Django's console EmailBackend writes there
# directly. Force UTF-8 so local dev on Windows doesn't crash; harmless
# elsewhere (Linux/Docker already default to UTF-8).
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
