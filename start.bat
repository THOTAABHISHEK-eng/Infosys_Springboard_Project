@echo off
cd /d "%~dp0"
title System-Wide Usage Tracker Launcher
echo =========================================================================
echo   SYSTEM-WIDE APPLICATION & BROWSER USAGE TRACKER
echo   Infosys Springboard Internship - Week 1 Deliverable
echo =========================================================================
echo.
echo [1/2] Launching System-Wide Background Tracking Daemon...
start "System Activity Tracker Daemon" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tracker-daemon.ps1"

echo [2/2] Opening Usage Analytics Dashboard in your browser...
start "" "%~dp0index.html"
echo.
echo Live tracking active for all laptop applications and browsers:
echo - WhatsApp, Brave, Microsoft Edge, Google Chrome, VS Code, Spotify, etc.
echo.
pause
