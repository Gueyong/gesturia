@echo off
REM ============================================================
REM  Gesturia — one-click launcher. Double-click this file.
REM  Starts the engine (API :8020) + web (:3003), opens the Studio.
REM ============================================================
title Gesturia - starting
echo.
echo   Starting Gesturia (engine + web)... this takes ~20-40s the first time.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0START_GESTURIA.ps1"
echo.
echo   If a browser did not open, go to:  http://127.0.0.1:3003/studio
echo.
pause
