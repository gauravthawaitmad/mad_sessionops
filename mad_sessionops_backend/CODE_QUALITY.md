# Code Quality Tools Setup

## ✅ Complete Code Quality Stack Configured!

Your project now has a comprehensive set of code quality tools following Dalgo backend best practices.

## 📋 Tools Configured

### 1. **Pylint** - Code Quality Analysis
- Configuration: `.pylintrc`
- Checks: Code style, errors, refactoring opportunities
- Minimum score: 6.5/10
- Django-aware with `pylint-django` plugin

### 2. **Black** - Code Formatting
- Configuration: `pyproject.toml`
- Line length: 100 characters
- Automatic code formatting
- PEP 8 compliant

### 3. **isort** - Import Sorting
- Configuration: `.isort.cfg` + `pyproject.toml`
- Sorts imports automatically
- Django-aware sections
- Black-compatible profile

### 4. **Flake8** - Style Guide Enforcement
- Configuration: `.flake8`
- PEP 8 style guide checking
- Cyclomatic complexity analysis
- Black-compatible

### 5. **MyPy** - Static Type Checking
- Configuration: `mypy.ini`
- Type hint verification
- Django stubs included
- Catches type errors before runtime

### 6. **Bandit** - Security Scanner
- Configuration: `.bandit`
- Finds common security issues
- SQL injection detection
- Weak cryptography detection

### 7. **Safety** - Dependency Security
- Checks for known vulnerabilities
- Scans all dependencies
- Database of CVEs

### 8. **Radon** - Code Metrics
- Cyclomatic complexity
- Maintainability index
- Code quality metrics

### 9. **Interrogate** - Docstring Coverage
- Checks documentation coverage
- Ensures code is documented

## 🚀 Quick Start

### Install Dependencies

```bash
uv sync
source .venv/bin/activate
```

### Run All Quality Checks

```bash
./check-quality.sh
```

This runs all 8 quality checks in sequence.

### Auto-fix Issues

```bash
./fix-quality.sh
```

This automatically fixes:
- Code formatting (Black)
- Import sorting (isort)
- Minor style issues

## 📝 Configuration Files

```
mad_backend/
├── .pylintrc                  # Pylint configuration
├── .flake8                    # Flake8 configuration
├── .isort.cfg                 # isort configuration
├── .bandit                    # Bandit security config
├── mypy.ini                   # MyPy type checking config
├── pyproject.toml             # Black, isort, pytest, coverage
├── check-quality.sh           # Run all checks
└── fix-quality.sh             # Auto-fix issues
```

## 🔍 Individual Tool Usage

### Pylint
```bash
# Check entire project
pylint madui/

# Check specific file
pylint madui/auth.py

# Generate report
pylint madui/ --output-format=json > pylint-report.json
```

### Black
```bash
# Check formatting
black --check madui/

# Format code
black madui/

# Show diff
black --diff madui/
```

### isort
```bash
# Check import sorting
isort --check-only madui/

# Sort imports
isort madui/

# Show diff
isort --diff madui/
```

### Flake8
```bash
# Check style
flake8 madui/

# Generate statistics
flake8 madui/ --statistics

# Check specific file
flake8 madui/auth.py
```

### MyPy
```bash
# Type check
mypy madui/

# Verbose output
mypy madui/ --verbose

# Generate HTML report
mypy madui/ --html-report mypy-report
```

### Bandit
```bash
# Security scan
bandit -r madui/

# Generate JSON report
bandit -r madui/ -f json -o bandit-report.json

# High severity only
bandit -r madui/ -ll
```

### Safety
```bash
# Check dependencies
safety check

# JSON output
safety check --json

# Full report
safety check --full-report
```

### Radon
```bash
# Cyclomatic complexity
radon cc madui/ -a

# Maintainability index
radon mi madui/

# Raw metrics
radon raw madui/

# Halstead metrics
radon hal madui/
```

### Interrogate
```bash
# Check docstring coverage
interrogate madui/

# Verbose output
interrogate -v madui/

# Generate badge
interrogate --generate-badge madui/
```

## ⚙️ Configuration Details

### Pylint Configuration

**Key Settings:**
- Django plugin enabled
- Minimum score: 6.5/10
- Max line length: 200
- 4 parallel jobs
- Common Django patterns allowed

**Disabled Checks:**
- Missing docstrings (can be enabled)
- Too many arguments/locals (reasonable limits)
- Broad exceptions (allowed for Django)

### Black Configuration

**Key Settings:**
- Line length: 100
- Target: Python 3.10, 3.11
- Excludes: migrations, venv, build

### Flake8 Configuration

**Key Settings:**
- Max line length: 200
- Max complexity: 15
- Ignores: E203, E501, W503 (Black-compatible)
- Per-file ignores for `__init__.py`

### MyPy Configuration

**Key Settings:**
- Django plugin enabled
- Check untyped defs
- Warn on unused ignores
- Ignore missing imports for third-party

## 🎯 Pre-commit Integration

The `.pre-commit-config.yaml` includes:
- Black formatting
- isort sorting
- Flake8 checking
- Trailing whitespace removal
- YAML/JSON validation

### Setup Pre-commit

```bash
pre-commit install
```

### Run Pre-commit

```bash
# Run on all files
pre-commit run --all-files

# Run on staged files
pre-commit run

# Update hooks
pre-commit autoupdate
```

## 📊 Quality Metrics

### What Gets Checked

| Tool | What It Checks | Auto-fix |
|------|---------------|----------|
| Black | Code formatting | ✅ Yes |
| isort | Import sorting | ✅ Yes |
| Flake8 | Style guide | ❌ No |
| Pylint | Code quality | ❌ No |
| MyPy | Type hints | ❌ No |
| Bandit | Security issues | ❌ No |
| Safety | Vulnerable deps | ❌ No |
| Radon | Code complexity | N/A |

### Code Complexity Guidelines

**Cyclomatic Complexity:**
- 1-5: Simple, low risk
- 6-10: Moderate complexity
- 11-20: Complex, consider refactoring
- 21+: Very complex, refactor

**Maintainability Index:**
- 85-100: Highly maintainable
- 65-84: Moderately maintainable
- <65: Difficult to maintain

## 🔧 IDE Integration

### VS Code

Install extensions:
- Python (Microsoft)
- Pylint
- Black Formatter
- isort

**Settings:**
```json
{
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black",
  "editor.formatOnSave": true,
  "[python]": {
    "editor.codeActionsOnSave": {
      "source.organizeImports": true
    }
  }
}
```

### PyCharm

- Enable Black: `Preferences → Tools → Black`
- Enable Pylint: `Preferences → Tools → External Tools`
- Enable isort: `Preferences → Tools → File Watchers`

## 🚨 Common Issues & Fixes

### Issue: Black and Flake8 Conflict
**Solution:** Already configured to be compatible

### Issue: Import order wrong
**Solution:** Run `isort madui/`

### Issue: Pylint score too low
**Solution:** Review warnings, fix critical issues

### Issue: Type errors in Django
**Solution:** Install `django-stubs`, already included

### Issue: Security warnings for Django patterns
**Solution:** Check `.bandit` excludes

## 📈 CI/CD Integration

All tools are integrated in `.github/workflows/ci.yml`:

```yaml
- Lint job runs: Black, isort, Pylint
- Security job runs: Bandit, Safety
- Code quality job runs: Radon, MyPy
```

## ✅ Checklist

Before committing code:
- [ ] Run `./fix-quality.sh` to auto-fix
- [ ] Run `./check-quality.sh` to verify
- [ ] Fix any remaining issues
- [ ] Ensure tests pass
- [ ] Commit changes

## 📚 References

- [Pylint Docs](https://pylint.pycqa.org/)
- [Black Docs](https://black.readthedocs.io/)
- [isort Docs](https://pycqa.github.io/isort/)
- [Flake8 Docs](https://flake8.pycqa.org/)
- [MyPy Docs](https://mypy.readthedocs.io/)
- [Bandit Docs](https://bandit.readthedocs.io/)

---

**Your code quality tools are ready!** 🎉

Run `./check-quality.sh` to start checking your code quality.

