@echo off
title Sarkari-Sarathi Server
color 0A

echo ========================================
echo    सरकारी-सारथी - AI Digital Scribe
echo ========================================
echo.

echo 🚀 Starting Sarkari-Sarathi Server...
echo.

REM Change to backend directory
cd backend
if errorlevel 1 (
    echo ❌ Failed to change to backend directory
    pause
    exit /b 1
)

echo ✅ Changed to backend directory
echo.

REM Check if virtual environment exists
if not exist ".env\Scripts\python.exe" (
    echo ⚠️  Virtual environment not found
    echo Creating virtual environment...
    python -m venv .env
    if errorlevel 1 (
        echo ❌ Failed to create virtual environment
        pause
        exit /b 1
    )
    echo ✅ Virtual environment created
    echo.
)

echo ✅ Virtual environment ready
echo.

REM Install dependencies
echo 📦 Installing dependencies...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed
echo.

REM Start the server
echo 🌟 Starting server...
echo.
echo Server will be available at: http://localhost:8000
echo API docs at: http://localhost:8000/docs
echo Press Ctrl+C to stop the server
echo.

REM Use the virtual environment Python directly
.env\Scripts\python.exe startup.py

echo.
echo Server stopped. Press any key to exit...
pause > nul
