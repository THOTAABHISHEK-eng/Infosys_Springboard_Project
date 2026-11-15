@echo off
cd /d "%~dp0"
title System-Wide Application ^& Browser Usage Tracker
echo =========================================================================
echo   SYSTEM-WIDE APPLICATION & BROWSER USAGE TRACKER
echo   Tracking WhatsApp, Edge, Brave, Chrome, VS Code, Discord, Spotify, etc.
echo =========================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tracker-daemon.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Tracker stopped.
    pause
)
