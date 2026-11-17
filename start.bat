@echo off
cd /d "%~dp0"
title System-Wide Usage Tracker Launcher
echo =========================================================================
echo   SYSTEM-WIDE APPLICATION & BROWSER USAGE TRACKER
echo   Infosys Springboard Internship - Week 1 Deliverable
echo =========================================================================
echo.

:: Check if server is already running on port 5500
netstat -ano | findstr :5500 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [Server] Local Dashboard Server is already active on port 5500.
) else (
    echo [1/3] Starting Local Dashboard Server on http://127.0.0.1:5500/ ...
    start "Dashboard Server" python server.py
)

:: Check if tracker daemon is already running
tasklist /fi "WINDOWTITLE eq System Activity Tracker Daemon" 2>nul | findstr /i "powershell.exe" >nul 2>&1
if %errorlevel% equ 0 (
    echo [Daemon] Tracker Daemon is already running.
) else (
    echo [2/3] Launching Background Tracking Daemon...
    start "System Activity Tracker Daemon" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tracker-daemon.ps1"
)

timeout /t 2 >nul
echo [3/3] Opening Usage Analytics Dashboard in your browser...
start "" "http://127.0.0.1:5500/"
echo.
echo Live tracking active for all laptop applications and browsers:
echo - WhatsApp, Brave, Microsoft Edge, Google Chrome, VS Code, Spotify, etc.
echo.
echo NOTE: Type sync() in Chrome Extension DevTools console to analyze real browsing history.
echo.
pause
