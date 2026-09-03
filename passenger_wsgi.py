import os
import sys

# 1. Add your project directory to the path
sys.path.insert(0, "/home4/toollzen/hrms-django")

# 2. Load environment variables from your .env file
from dotenv import load_dotenv
load_dotenv(os.path.join("/home4/toollzen/hrms-django", ".env"))

# 3. Point to your Django settings file
# IMPORTANT: Change "hrms.settings" if your inner folder is named differently
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hrms.settings")

# 4. Expose the WSGI application for cPanel/Passenger
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()