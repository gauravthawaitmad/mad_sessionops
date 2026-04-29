#!/bin/bash

# Code Quality Check Script
# Run all linting and code quality tools

set -e  # Exit on first error

echo "🔍 Running Code Quality Checks..."
echo ""

# Colors for output
GREEN='\033[0.32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if virtual environment is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo "${YELLOW}Warning: Virtual environment not activated!${NC}"
    echo "Activating virtual environment..."
    source .venv/bin/activate
fi

# Track failures
FAILED=0

# 1. Black - Code Formatting
echo "${YELLOW}1/8 Checking code formatting with Black...${NC}"
if black --check madui/; then
    echo "${GREEN}✓ Black check passed${NC}"
else
    echo "${RED}✗ Black check failed${NC}"
    echo "Run 'black madui/' to fix"
    FAILED=1
fi
echo ""

# 2. isort - Import Sorting
echo "${YELLOW}2/8 Checking import sorting with isort...${NC}"
if isort --check-only madui/; then
    echo "${GREEN}✓ isort check passed${NC}"
else
    echo "${RED}✗ isort check failed${NC}"
    echo "Run 'isort madui/' to fix"
    FAILED=1
fi
echo ""

# 3. Flake8 - Style Guide
echo "${YELLOW}3/8 Checking style guide with Flake8...${NC}"
if flake8 madui/; then
    echo "${GREEN}✓ Flake8 check passed${NC}"
else
    echo "${RED}✗ Flake8 check failed${NC}"
    FAILED=1
fi
echo ""

# 4. Pylint - Code Quality
echo "${YELLOW}4/8 Checking code quality with Pylint...${NC}"
if pylint madui/ --rcfile=.pylintrc; then
    echo "${GREEN}✓ Pylint check passed${NC}"
else
    echo "${RED}✗ Pylint check failed (or score below threshold)${NC}"
    FAILED=1
fi
echo ""

# 5. MyPy - Type Checking
echo "${YELLOW}5/8 Checking types with MyPy...${NC}"
if mypy madui/ --config-file=mypy.ini; then
    echo "${GREEN}✓ MyPy check passed${NC}"
else
    echo "${RED}✗ MyPy check failed${NC}"
    FAILED=1
fi
echo ""

# 6. Bandit - Security Scan
echo "${YELLOW}6/8 Running security scan with Bandit...${NC}"
if bandit -r madui/ -c .bandit; then
    echo "${GREEN}✓ Bandit security scan passed${NC}"
else
    echo "${RED}✗ Bandit found security issues${NC}"
    FAILED=1
fi
echo ""

# 7. Safety - Dependency Security
echo "${YELLOW}7/8 Checking dependencies with Safety...${NC}"
if safety check; then
    echo "${GREEN}✓ Safety check passed${NC}"
else
    echo "${RED}✗ Safety found vulnerable dependencies${NC}"
    FAILED=1
fi
echo ""

# 8. Radon - Code Complexity
echo "${YELLOW}8/8 Checking code complexity with Radon...${NC}"
echo "Cyclomatic Complexity:"
radon cc madui/ -a -nb
echo ""
echo "Maintainability Index:"
radon mi madui/ -nb
echo ""

# Summary
echo "======================================"
if [ $FAILED -eq 0 ]; then
    echo "${GREEN}✅ All code quality checks passed!${NC}"
    exit 0
else
    echo "${RED}❌ Some code quality checks failed!${NC}"
    echo ""
    echo "To fix formatting issues automatically, run:"
    echo "  black madui/"
    echo "  isort madui/"
    exit 1
fi

