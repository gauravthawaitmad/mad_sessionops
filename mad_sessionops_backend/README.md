# Session-Ops Backend

Django + Ninja backend for Session-Ops, MAD's school operations platform.

[![Backend CI](https://github.com/makeadiff/mad_sessionops/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/makeadiff/mad_sessionops/actions/workflows/backend-ci.yml)
[![codecov](https://codecov.io/gh/makeadiff/mad_sessionops/branch/main/graph/badge.svg?flag=backend)](https://codecov.io/gh/makeadiff/mad_sessionops)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Overview

This is a production Django + Django Ninja backend, originally scaffolded from patterns observed in the Dalgo backend project. It includes:

- **Django 4.2** with Django Ninja for API development
- **JWT Authentication** with cookie support
- **PostgreSQL** database
- **Sentry** integration for error tracking
- **Prometheus** metrics for monitoring
- **Pre-commit hooks** for code quality

## Development Conventions

### API Endpoint Naming

- REST conventions are followed
- CRUD endpoints for a User resource look like:
  - `GET /api/users/`
  - `GET /api/users/{user_id}`
  - `POST /api/users/`
  - `PUT /api/users/{user_id}`
  - `DELETE /api/users/{user_id}`
- Route parameters should be named in snake_case

### API Documentation

- All API docs are available at `http://localhost:8000/api/docs`
- Public API docs at `http://localhost:8000/api/v1/public/docs`

### Code Style

- **PEP8** is used to standardize variable names, classes, module names, etc.
- **Pylint** is the linting tool used to analyze the code as per PEP8 style
- **Black** is used as the code formatter with a line length of 100

### Setting up VSCode

- Recommended IDE is VSCode
- Install the pylint extension in VSCode and enable it
- Set the default format provider in VSCode as `black`
- Update the VSCode settings.json:

```json
{
  "editor.defaultFormatter": null,
  "python.linting.enabled": true,
  "python.formatting.provider": "black",
  "editor.formatOnSave": true
}
```

## Prerequisites

- Python 3.12+
- PostgreSQL
- UV package manager (recommended)

## UV Package Manager

This project uses `uv` as its package manager for faster dependency installation.

### Install UV

**macOS/Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Windows (PowerShell as Administrator):**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Homebrew:**
```bash
brew install uv
```

## Development Setup

### Prerequisites
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager
- Docker (for Redis only)
- [just](https://github.com/casey/just) (optional, for command shortcuts)

### First-time setup

```bash
# Install dependencies
uv sync --frozen

# Copy env file and fill in values
cp env.template .env.development
# Edit .env.development with RDS credentials and Google OAuth secrets

# Start Redis (one-time — persists across reboots)
just redis-start
# OR without just:
docker run -d --name sessionops-redis --restart unless-stopped \
  -p 6379:6379 redis:7-alpine

# Run migrations
just migrate
```

### Daily workflow

Open three terminals:

```bash
# Terminal 1 — Django
just serve

# Terminal 2 — Celery worker
just worker

# Terminal 3 — Celery beat
just beat
```

### Common commands

```bash
just              # List all commands
just shell        # Django shell
just migrate      # Apply migrations
just makemigrations sessionops
just test
just lint
just fmt
```

## Project Structure

```
mad_sessionops_backend/         # Root directory (repository)
├── sessionops/                 # Django application
│   ├── api/                    # API endpoints
│   │   ├── __init__.py
│   │   └── user_api.py        # Sample user API
│   ├── management/             # Custom management commands
│   │   └── commands/
│   ├── models/                 # Database models
│   ├── schemas/                # Pydantic schemas
│   ├── tests/                  # Test files
│   ├── utils/                  # Utility functions
│   │   └── custom_logger.py   # Custom logging
│   ├── logs/                   # Application logs
│   ├── __init__.py            # Celery initialization
│   ├── asgi.py                # ASGI configuration
│   ├── auth.py                # Authentication & authorization
│   ├── celery.py              # Celery configuration
│   ├── routes.py              # API route definitions
│   ├── settings.py            # Django settings
│   ├── urls.py                # URL configuration
│   ├── wsgi.py                # WSGI configuration
│   └── admin.py               # Admin configuration
├── manage.py                  # Django management script
├── justfile                   # Dev command shortcuts
├── env.template               # Environment variables template
├── .gitignore                 # Git ignore rules
├── .pre-commit-config.yaml    # Pre-commit hooks configuration
├── pyproject.toml             # Project dependencies and configuration
└── README.md                  # This file
```

## Key Features

### JWT Authentication with Cookie Support

The authentication system supports both:
- Bearer token authentication (Authorization header)
- Cookie-based authentication (access_token cookie)

Cookies are prioritized for better security and ease of use.

### Role-Based Access Control

The application includes a flexible RBAC system with:
- Permission-based access control
- Decorator-based permission checks

Example:
```python
from sessionops.auth import has_permission

@has_permission(["read:users", "write:users"])
def my_api_endpoint(request):
    # Your code here
    pass
```

### Logging

Structured logging is configured with:
- Console output for development
- File rotation for production
- Sentry integration for error tracking

### API Documentation

Automatically generated API documentation is available at:
- Main API: `http://localhost:8000/api/docs`
- Public API: `http://localhost:8000/api/v1/public/docs`

### Health Checks

- `/healthcheck` - Basic health check
- `/prometheus/` - Prometheus metrics endpoint

## Testing

Run tests using pytest:

```bash
pytest
```

With coverage:

```bash
pytest --cov=sessionops --cov-report=html
```

## Environment Variables

Key environment variables (see `env.template` for full list):

- `DJANGOSECRET` - Django secret key
- `DEBUG` - Debug mode (True/False)
- `DBNAME`, `DBHOST`, `DBPORT`, `DBUSER`, `DBPASSWORD` - Database credentials
- `REDIS_HOST`, `REDIS_PORT` - Redis configuration
- `JWT_SECRET_KEY` - JWT signing key
- `SENTRY_DSN` - Sentry error tracking DSN
- `FRONTEND_URL` - Frontend application URL for CORS

## Best Practices Implemented

1. **Security**
   - Environment-based configuration
   - Secret key management
   - JWT with short-lived tokens
   - CORS configuration
   - CSRF protection

2. **Code Quality**
   - PEP8 compliance
   - Type hints
   - Pre-commit hooks
   - Automated testing
   - Code coverage

3. **Performance**
   - Database query optimization
   - Connection pooling

4. **Monitoring**
   - Structured logging
   - Sentry error tracking
   - Prometheus metrics
   - Health check endpoints

5. **Scalability**
   - Stateless design
   - Horizontal scaling ready
   - Load balancer support

## Contributing

1. Create a feature branch
2. Make your changes
3. Run pre-commit hooks: `pre-commit run --all-files`
4. Run tests: `pytest`
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please create an issue in the repository.
