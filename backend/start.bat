@echo off
title Sarkari-Sarathi Backend
color 0A

echo 🚀 Starting Sarkari-Sarathi Backend...
echo.

REM Install dependencies if needed
echo 📦 Checking dependencies...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies ready
echo.

REM Start the server
echo 🌟 Starting server with Nepali ASR...
echo.
echo Server will be available at: http://localhost:8000
echo API docs at: http://localhost:8000/docs
echo Press Ctrl+C to stop
echo.

REM Start the server
python startup.py

echo.
echo Server stopped. Press any key to exit...
pause > nul
