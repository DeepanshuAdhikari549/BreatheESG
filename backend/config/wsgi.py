"""
WSGI config for ESG Ingestion Platform.
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_wsgi_application()

try:
    from django.core.management import call_command
    import seed
    print("Running automatic migrations and DB seeding on startup...")
    call_command("migrate", interactive=False)
    seed.seed()
except Exception as e:
    print("Warning: Automatic migration/seeding failed:", e)
