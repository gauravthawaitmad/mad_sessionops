"""
Initialize the sessionops Django application.
"""

# Make the Celery app available so Django's AppRegistry
# picks it up before any app is imported.
from sessionops.celery import app as celery_app

__all__ = ("celery_app",)
