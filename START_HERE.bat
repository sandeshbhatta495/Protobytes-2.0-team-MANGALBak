@echo off
title Sarkari-Sarathi Setup
color 0A

echo ========================================
echo    सरकारी-सारथी - AI Digital Scribe
echo ========================================
echo.

echo 🚀 Starting Sarkari-Sarathi Backend Setup...
echo.

REM Check if we're in the right directory
if not exist "backend\startup.py" (
    echo ❌ Error: Please run this from the project root directory
    echo    Current directory should contain: backend\startup.py
    echo.
    pause
    exit /b 1
)

echo ✅ Project structure verified
echo.

REM Change to backend directory
cd backend
echo 📁 Changed to backend directory
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

REM Activate virtual environment using batch file (avoids PowerShell issues)
echo 🔧 Activating virtual environment...
call .env\Scripts\activate.bat
if errorlevel 1 (
    echo ⚠️  Activation failed, trying alternative method...
    .env\Scripts\python.exe startup.py
    if errorlevel 1 (
        echo ❌ Failed to start server
        pause
        exit /b 1
    )
) else (
    echo ✅ Virtual environment activated
    echo.
    
    REM Run startup script
    echo 🌟 Running setup and starting server...
    echo.
    python startup.py
)

echo.
echo Server stopped. Press any key to exit...
pause > nul
