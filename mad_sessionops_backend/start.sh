#!/bin/bash

# Start script for development
# Following Dalgo backend best practices

echo "Starting MAD Backend..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please copy env.template to .env and configure it."
    exit 1
fi

# Check if virtual environment is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo "Warning: Virtual environment not activated!"
    echo "Activating virtual environment..."
    source .venv/bin/activate
fi

# Check if logs directory exists
if [ ! -d "madui/logs" ]; then
    echo "Creating logs directory..."
    mkdir -p madui/logs
fi

# Run migrations
echo "Running database migrations..."
python manage.py migrate

# Start the server
echo "Starting development server..."
uvicorn madui.asgi:application --port 8000 --reload

