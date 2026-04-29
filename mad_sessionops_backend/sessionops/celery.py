"""
Celery application for MAD backend.

Bound to Django settings so all tasks have ORM access.
Broker URL is read from CELERY_BROKER_URL env var (default: redis://redis:6379/0).
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sessionops.settings")

app = Celery("sessionops")

# Load config from Django settings, namespace CELERY_ to avoid conflicts.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all INSTALLED_APPS.
app.autodiscover_tasks()
