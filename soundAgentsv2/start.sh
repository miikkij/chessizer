#!/bin/bash

# Chess Sound WAV Generator Microservice Startup Script

echo "Setting up Chess Sound WAV Generator microservice..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "Activating virtual environment (Windows)..."
    source venv/Scripts/activate
else
    echo "Activating virtual environment (Unix)..."
    source venv/bin/activate
fi

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Start the microservice
echo "Starting Chess Sound WAV Generator microservice on port 8001..."
echo "API will be available at: http://localhost:8001"
echo "Documentation at: http://localhost:8001/docs"
echo ""

python main.py