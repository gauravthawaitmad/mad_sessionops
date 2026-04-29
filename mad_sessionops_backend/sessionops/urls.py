"""
URL configuration for mad_backend project.

Following Dalgo backend best practices for URL routing.
"""

from django.contrib import admin
from django.urls import include, path
from django.http import HttpResponse

from sessionops.routes import api, public_api


def healthcheck(request):
    """Healthcheck endpoint for load balancers"""
    return HttpResponse("OK")


def trigger_error(request):
    """Endpoint to test Sentry error tracking"""
    division_by_zero = 1 / 0
    return HttpResponse("This should never be reached")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthcheck", healthcheck),
    path("sentry-debug/", trigger_error),
    path("prometheus/", include("django_prometheus.urls")),
    path("", api.urls),  # Authenticated API
    path("", public_api.urls),  # Public API without auth
]

# WebSocket URL patterns (for future use)
ws_urlpatterns = [
    # Add websocket routes here
]

