@echo off
cd /d "%~dp0"
title System-Wide Usage Tracker Launcher
echo =========================================================================
echo   SYSTEM-WIDE APPLICATION & BROWSER USAGE TRACKER
echo   Infosys Springboard Internship - Week 1 Deliverable
echo =========================================================================
echo.
echo [1/3] Launching System-Wide Background Tracking Daemon...
start "System Activity Tracker Daemon" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tracker-daemon.ps1"

echo [2/3] Starting Local Dashboard Server on http://127.0.0.1:5500/
start "Dashboard Server" python server.py

timeout /t 2 >nul
echo [3/3] Opening Usage Analytics Dashboard in your browser...
start "" "http://127.0.0.1:5500/"
echo.
echo Live tracking active for all laptop applications and browsers:
echo - WhatsApp, Brave, Microsoft Edge, Google Chrome, VS Code, Spotify, etc.
echo.
echo NOTE: The dashboard must be served over http://127.0.0.1:5500/ so it can
echo read the live state file. Do not open index.html directly (file://).
echo.
pause
