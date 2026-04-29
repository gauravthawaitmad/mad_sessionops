# Contributing to MAD Backend

Thank you for considering contributing to MAD Backend! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## 📜 Code of Conduct

This project follows a Code of Conduct. By participating, you are expected to uphold this code. Please be respectful and considerate in your interactions.

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- PostgreSQL
- Git
- UV package manager (recommended)

### Setup Development Environment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/mad_backend.git
   cd mad_backend
   ```

2. **Install UV package manager**
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

3. **Create virtual environment and install dependencies**
   ```bash
   uv sync
   source .venv/bin/activate
   ```

4. **Setup pre-commit hooks**
   ```bash
   pre-commit install
   ```

5. **Configure environment**
   ```bash
   cp env.template .env
   # Edit .env with your local settings
   ```

6. **Setup database**
   ```bash
   docker run --name postgres-db -e POSTGRES_PASSWORD=yourpass -p 5432:5432 -d postgres
   ```

7. **Run migrations**
   ```bash
   python manage.py migrate
   ```

8. **Start development server**
   ```bash
   ./start.sh
   ```

## 🔄 Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b bugfix/issue-description
```

Branch naming conventions:
- `feature/` - New features
- `bugfix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/modifications
- `perf/` - Performance improvements

### 2. Make Your Changes

- Write clean, readable code
- Follow the project's coding standards
- Add/update tests for your changes
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=madui --cov-report=html

# Run linting
black madui/
pylint madui/

# Run pre-commit hooks
pre-commit run --all-files
```

### 4. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add new authentication endpoint"
git commit -m "fix: resolve database connection issue"
git commit -m "docs: update API documentation"
```

Commit message format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Test additions/modifications
- `chore:` - Maintenance tasks
- `perf:` - Performance improvements

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## 📝 Coding Standards

### Python Style Guide

- **PEP 8** compliance
- **Black** for code formatting (line length: 100)
- **isort** for import sorting
- **Pylint** for code quality

### Code Quality Requirements

- Minimum pylint score: 6.5
- Test coverage: Aim for >80%
- All tests must pass
- No linting errors

### Best Practices

1. **DRY Principle** - Don't Repeat Yourself
2. **SOLID Principles** - Follow object-oriented design principles
3. **Meaningful Names** - Use descriptive variable and function names
4. **Comments** - Write clear comments for complex logic
5. **Type Hints** - Use type hints where appropriate
6. **Error Handling** - Proper exception handling with informative messages

### Django-Specific Guidelines

- Use Django ORM effectively (`select_related`, `prefetch_related`)
- Follow Django REST conventions for API endpoints
- Use Django Ninja schemas for request/response validation
- Implement proper permission checks
- Write comprehensive docstrings

### API Design

- RESTful conventions
- Proper HTTP status codes
- Consistent error responses
- API versioning when needed
- OpenAPI documentation

## 🧪 Testing

### Test Structure

```
madui/tests/
├── __init__.py
├── test_api.py
├── test_models.py
├── test_utils.py
└── test_integration.py
```

### Writing Tests

```python
import pytest
from django.test import TestCase

class MyTestCase(TestCase):
    def setUp(self):
        """Setup test data"""
        pass

    def test_feature(self):
        """Test description"""
        # Arrange
        # Act
        # Assert
        pass

@pytest.mark.django_db
def test_with_pytest():
    """Pytest style test"""
    assert True
```

### Running Tests

```bash
# All tests
pytest

# Specific test file
pytest madui/tests/test_api.py

# Specific test
pytest madui/tests/test_api.py::test_function_name

# With coverage
pytest --cov=madui --cov-report=html

# Verbose output
pytest -v
```

## 📤 Submitting Changes

### Pull Request Process

1. **Update Documentation** - Update README, API docs, etc.
2. **Add Tests** - Ensure your changes are tested
3. **Run Tests** - All tests must pass
4. **Update Changelog** - Add entry to CHANGELOG.md if applicable
5. **Create PR** - Use the PR template
6. **Address Reviews** - Respond to review comments

### PR Requirements

- ✅ All tests pass
- ✅ No linting errors
- ✅ Documentation updated
- ✅ PR template filled out
- ✅ Commits follow conventional commits
- ✅ Branch is up to date with main

### Review Process

- At least one approval required
- All comments addressed
- CI/CD checks pass
- No merge conflicts

## 🐛 Reporting Issues

### Before Creating an Issue

1. Search existing issues
2. Check documentation
3. Verify it's reproducible

### Creating an Issue

Use the appropriate issue template:

- **Bug Report** - For reporting bugs
- **Feature Request** - For suggesting features
- **Documentation** - For documentation issues
- **Question** - For asking questions
- **Security** - For security vulnerabilities
- **Performance** - For performance issues

### Good Issue Examples

**Bug Report:**
```
Title: [BUG] Login fails with empty password

Description: When submitting login form with empty password,
server returns 500 instead of 400 validation error.

Steps to Reproduce:
1. Go to /api/login
2. Submit with email only
3. See 500 error

Expected: 400 validation error
Actual: 500 server error

Environment:
- OS: macOS 14.0
- Python: 3.10.5
- Django: 4.2
```

## 💬 Communication

- **Issues** - Bug reports, feature requests
- **Pull Requests** - Code contributions
- **Discussions** - General questions and ideas

## 🙏 Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project documentation

## 📚 Additional Resources

- [README.md](README.md) - Project overview
- [BEST_PRACTICES.md](BEST_PRACTICES.md) - Best practices guide
- [API Documentation](http://localhost:8000/api/docs) - API docs

## ❓ Questions?

If you have questions, please:
1. Check the documentation
2. Search existing issues
3. Create a question issue
4. Reach out to maintainers

Thank you for contributing! 🎉

