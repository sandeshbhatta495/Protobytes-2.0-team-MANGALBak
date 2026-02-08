@echo off
title Port Checker - Sarkari-Sarathi
color 0B

echo ========================================
echo    Port Checker for Sarkari-Sarathi
echo ========================================
echo.

echo 🔍 Checking what's using port 8000...
echo.

REM Check what's using port 8000
netstat -ano | findstr :8000

if errorlevel 1 (
    echo ✅ Port 8000 is available
    echo.
    echo You can start the server normally.
) else (
    echo ⚠️  Port 8000 is in use
    echo.
    echo Processes using port 8000:
    netstat -ano | findstr :8000
    echo.
    echo To kill the process, run:
    echo   taskkill /PID [PID] /F
    echo.
    echo Or the server will automatically use port 8001, 8002, etc.
)

echo.
echo Press any key to exit...
pause > nul
