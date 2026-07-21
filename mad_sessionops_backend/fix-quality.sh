#!/bin/bash

# Auto-fix Code Quality Issues
# Automatically fix formatting and style issues

set -e

echo "🔧 Auto-fixing code quality issues..."
echo ""

# Check if virtual environment is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo "Warning: Virtual environment not activated!"
    echo "Activating virtual environment..."
    source .venv/bin/activate
fi

# 1. Black - Format code
echo "1/3 Formatting code with Black..."
black sessionops/
echo "✓ Black formatting complete"
echo ""

# 2. isort - Sort imports
echo "2/3 Sorting imports with isort..."
isort sessionops/
echo "✓ Import sorting complete"
echo ""

# 3. Remove unused imports (if autopep8 is installed)
echo "3/3 Cleaning up code..."
if command -v autopep8 &> /dev/null; then
    autopep8 --in-place --recursive sessionops/
    echo "✓ Code cleanup complete"
else
    echo "⚠ autopep8 not installed, skipping cleanup"
fi
echo ""

echo "✅ All auto-fixes complete!"
echo ""
echo "Now run './check-quality.sh' to verify changes"

