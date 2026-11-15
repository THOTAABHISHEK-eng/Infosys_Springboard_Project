@echo off
title AI Attention Management System - Backend Server
echo ========================================================
echo   AI-Powered Digital Attention Management System
echo   FastAPI + SQLite + Scikit-Learn Server
echo ========================================================
echo.

where uvicorn >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting FastAPI server with Uvicorn on http://127.0.0.1:8000 ...
    uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
    goto end
)

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting with Python launcher (py)...
    py -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
    goto end
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting with python...
    python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
    goto end
)

echo [Notice] Python or Uvicorn was not detected in PATH.
echo Please install requirements via: pip install -r backend\requirements.txt
echo The Dashboard and Browser Extension will run in client-side mode with local persistence!
echo.

:end
pause

