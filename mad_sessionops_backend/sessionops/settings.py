"""
Django settings for mad_app project.

Following Dalgo backend best practices:
- Environment-based configuration
- Security-first approach
- Proper logging setup
- JWT authentication
- CORS configuration
- Sentry integration
"""

import os
from pathlib import Path
import logging
from datetime import timedelta

import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from corsheaders.defaults import default_headers
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
env_file = BASE_DIR / f".env.{ENVIRONMENT}"

if not env_file.exists():
    raise RuntimeError(f"Env file not found: {env_file}")

load_dotenv(dotenv_path=env_file, override=False)

SECRET_KEY = os.getenv("DJANGOSECRET", "")  # or SECRET_KEY
if not SECRET_KEY:
    raise RuntimeError(f"DJANGOSECRET is missing in {env_file}")

DEBUG = os.getenv("DEBUG", "False") == "True"
PRODUCTION = ENVIRONMENT == "production"



# Sentry Setup
sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[
        DjangoIntegration(),
        LoggingIntegration(level=logging.INFO, event_level=logging.WARNING),
    ],
    traces_sample_rate=float(os.getenv("SENTRY_TSR", "1.0")),
    profiles_sample_rate=float(os.getenv("SENTRY_PSR", "1.0")),
    enable_logs=os.getenv("SENTRY_ENABLE_LOGS", "True") == "True",
    send_default_pii=os.getenv("SENTRY_SEND_DEFAULT_PII", "True") == "True",
    environment=ENVIRONMENT,
)

# CORS Configuration
ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if h.strip()
]

CORS_ALLOW_ALL_ORIGINS = DEBUG  # Allow all in development only (DEBUG=False in production)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001",
    ).split(",")
    if o.strip()
]
CORS_ALLOW_METHODS = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
]
CORS_ALLOW_HEADERS = (
    *default_headers,
    "x-mad-org",
    "X-CSRFToken",
    # Custom headers from frontend
    "X-Request-ID",
    "X-Client-Version",
    "X-Client-Platform",
    "X-Timezone",
    "Accept-Language",
)

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "ninja",
    "sessionops",
    "django_prometheus",
    "django_extensions",
    "django_celery_beat",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
}

MIDDLEWARE = [
    "django_prometheus.middleware.PrometheusBeforeMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",
]

ROOT_URLCONF = "sessionops.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "sessionops.wsgi.application"
ASGI_APPLICATION = "sessionops.asgi.application"

# Database
# =============================================================================
# DATABASE SCHEMA CONFIGURATION
# =============================================================================
# PostgreSQL supports multiple schemas within a database.
# - 'public' is the default schema
# - You can use custom schemas like 'mad_platform_dev' for isolation
#
# Set DBSCHEMA in your .env file:
#   DBSCHEMA=mad_platform_dev   (for custom schema)
#   DBSCHEMA=public             (for default)
# =============================================================================
DBSCHEMA = os.getenv("DBSCHEMA", "public")

_DB_OPTIONS = {"options": f"-c search_path={DBSCHEMA},public"}

# Tests run as admin user because the app user lacks CREATEDB. The test DB is
# destroyed after each run — no lasting privilege escalation.
import sys as _sys
_TESTING = any("pytest" in a for a in _sys.argv) or os.environ.get("PYTEST_CURRENT_TEST")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DBNAME"),
        "HOST": os.getenv("DBHOST"),
        "USER": os.getenv("DBADMINUSER", os.getenv("DBUSER")) if _TESTING else os.getenv("DBUSER"),
        "PASSWORD": os.getenv("DBADMINPASSWORD", os.getenv("DBPASSWORD")) if _TESTING else os.getenv("DBPASSWORD"),
        "PORT": os.getenv("DBPORT"),
        "OPTIONS": _DB_OPTIONS,
    },
    # Used only for `just migrate` — needs DDL rights (table owner or superuser).
    # Set DBADMINUSER / DBADMINPASSWORD in your .env file.
    "migrate": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DBNAME"),
        "HOST": os.getenv("DBHOST"),
        "USER": os.getenv("DBADMINUSER", os.getenv("DBUSER")),
        "PASSWORD": os.getenv("DBADMINPASSWORD", os.getenv("DBPASSWORD")),
        "PORT": os.getenv("DBPORT"),
        "OPTIONS": _DB_OPTIONS,
    },
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Media files
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# JWT Configuration
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRY_HOURS", "12"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRY_DAYS", "30"))),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "SIGNING_KEY": os.getenv("JWT_SECRET_KEY", SECRET_KEY),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# Celery Configuration
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# Frontend URLs
FRONTEND_URL = os.getenv("FRONTEND_URL")
FRONTEND_URL_V2 = os.getenv("FRONTEND_URL_V2")

# Google OAuth Configuration
# Get your Client ID from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# Cookie settings
COOKIE_SECURE = True
COOKIE_SAMESITE = "Lax" if PRODUCTION else "None"
COOKIE_HTTPONLY = True

# Data upload settings
DATA_UPLOAD_MAX_MEMORY_SIZE = 5242880  # 5 MB

# Logging Configuration
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {asctime} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": BASE_DIR / "sessionops" / "logs" / "sessionops.log",
            "maxBytes": 1024 * 1024 * 10,  # 10 MB
            "backupCount": 5,
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console", "file"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
            "propagate": False,
        },
        "mad_backend": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
    },
}


# =============================================================================
# STARTUP INFO - Prints when server starts
# =============================================================================
def print_startup_info():
    """Print environment and database info on startup."""
    db = DATABASES["default"]
    print("\n" + "=" * 60)
    print("  MAD BACKEND SERVER STARTING")
    print("=" * 60)
    print(f"  Environment : {ENVIRONMENT.upper()}")
    print(f"  Debug Mode  : {DEBUG}")
    print(f"  Env File    : {env_file}")
    print("-" * 60)
    print(f"  Database    : {db['NAME']}")
    print(f"  DB Host     : {db['HOST']}:{db['PORT']}")
    print(f"  DB User     : {db['USER']}")
    print("-" * 60)
    print(f"  API Docs    : http://localhost:8000/api/docs")
    print(f"  Admin       : http://localhost:8000/admin/")
    print("=" * 60 + "\n")


# Only print on actual server start (not during migrations, shell, etc.)
import sys
if "runserver" in sys.argv or "uvicorn" in sys.argv[0] if sys.argv else False:
    print_startup_info()
