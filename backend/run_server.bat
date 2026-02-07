@echo off
echo 🚀 Starting Sarkari-Sarathi Backend...
echo.

REM Check if virtual environment is activated
if not defined VIRTUAL_ENV (
    echo ⚠️  Warning: Virtual environment not detected
    echo Please activate virtual environment first:
    echo   .env\Scripts\activate
    echo.
    pause
    exit /b 1
)

echo ✅ Virtual environment detected
echo.

REM Install dependencies if needed
echo 📦 Checking dependencies...
python -c "import fastapi, uvicorn" 2>nul
if errorlevel 1 (
    echo Installing missing dependencies...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

echo ✅ Dependencies OK
echo.

REM Check FFmpeg
echo 🔍 Checking FFmpeg...
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  FFmpeg not found. Audio processing may be limited.
    echo Install FFmpeg: choco install ffmpeg
    echo Or download from: https://ffmpeg.org/download.html
    echo.
)

echo 🌐 Starting server...
echo Server will be available at: http://localhost:8000
echo API docs at: http://localhost:8000/docs
echo Press Ctrl+C to stop the server
echo.

REM Start the server
python startup.py

pause
