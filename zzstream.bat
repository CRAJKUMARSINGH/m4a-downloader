@echo off
title YouTube Audio Downloader
color 0A

echo.
echo ========================================
echo   YouTube Audio Downloader
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.7+ from python.org
    echo.
    pause
    exit /b 1
)

echo [OK] Python found
echo.

REM Check if dependencies are installed
echo Checking dependencies...
python -c "import streamlit" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing dependencies...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
) else (
    echo [OK] Dependencies already installed
)

echo.
echo Starting app...
echo.
echo The app will open in your default browser
echo Press Ctrl+C to stop the server
echo.

REM Start Streamlit
streamlit run app.py

pause
