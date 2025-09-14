@echo off
REM Chess Sound WAV Generator Microservice Startup Script for Windows

echo Setting up Chess Sound WAV Generator microservice...

REM Create virtual environment if it doesn't exist
if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate

REM Install dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

REM Start the microservice
echo Starting Chess Sound WAV Generator microservice on port 8001...
echo API will be available at: http://localhost:8001
echo Documentation at: http://localhost:8001/docs
echo.

python main.py