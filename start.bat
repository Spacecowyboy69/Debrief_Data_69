@echo off
REM Start script for ADIZ Dashboard (Windows)
REM This starts a simple Python web server

echo.
echo ========================================
echo   ADIZ Dashboard - Starting Server
echo ========================================
echo.
echo Server will run at: http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
echo Opening browser in 3 seconds...
echo.

REM Try Python 3 first
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Using Python...
    timeout /t 3 /nobreak >nul
    start http://localhost:8000
    python -m http.server 8000
) else (
    echo.
    echo ERROR: Python not found!
    echo.
    echo Please install Python from https://www.python.org/downloads/
    echo Or see HOW_TO_RUN.md for alternative methods
    echo.
    pause
)
