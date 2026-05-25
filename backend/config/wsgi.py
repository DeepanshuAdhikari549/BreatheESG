"""
WSGI config for ESG Ingestion Platform.
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_wsgi_application()

if os.environ.get("RUN_STARTUP_TASKS", "true").lower() == "true":
    try:
        from django.core.management import call_command
        import seed
        print("Running automatic migrations and DB seeding on startup...")
        call_command("migrate", interactive=False)
        seed.seed()
        print("Startup migrations and seeding complete.")
    except Exception as e:
        print("Warning: Automatic migration/seeding failed:", e)
