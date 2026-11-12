@echo off
echo ========================================
echo   ResumeIQ - AI Resume Analyser
echo ========================================
echo.

REM Change to the directory where start.bat lives
cd /d "%~dp0"

REM Check Python is installed
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found. Please install Python 3.9+
    pause
    exit /b 1
)

REM Check .env file exists
if not exist ".env" (
    echo ERROR: .env file not found.
    echo Please create a .env file with:
    echo   GOOGLE_API_KEY=your_key_here
    pause
    exit /b 1
)

echo Starting ResumeIQ on http://localhost:5000
echo Press Ctrl+C to stop.
echo.

python app.py

pause
