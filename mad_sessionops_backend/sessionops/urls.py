"""
URL configuration for mad_backend project.

Following Dalgo backend best practices for URL routing.
"""

from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path

from sessionops.routes import api, public_api


def healthcheck(request):
    """Healthcheck endpoint for load balancers"""
    return HttpResponse("OK")


def trigger_error(request):
    """Endpoint to test Sentry error tracking"""
    1 / 0  # noqa: B018 — intentional ZeroDivisionError to verify Sentry capture
    return HttpResponse("This should never be reached")


urlpatterns = [
    # Renamed off "admin/" to avoid colliding with the frontend's own /admin
    # route behind the reverse proxy (both containers previously answered to
    # /admin, and the proxy's rule for it forwarded to this backend, shadowing
    # the frontend page). Proxy config must route /django-admin/ here instead.
    path("django-admin/", admin.site.urls),
    path("healthcheck", healthcheck),
    path("sentry-debug/", trigger_error),
    path("prometheus/", include("django_prometheus.urls")),
    path("", api.urls),  # Authenticated API
    path("", public_api.urls),  # Public API without auth
]

# WebSocket URL patterns (for future use)
ws_urlpatterns: list = [
    # Add websocket routes here
]
