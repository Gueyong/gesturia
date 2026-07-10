@echo off
REM ============================================================
REM  Gesturia — one-click video extraction (Multi-HMR + WiLoR).
REM  DRAG a folder of sign videos onto this file, or double-click
REM  and paste the folder path.
REM
REM  Folder layout (either works):
REM    A) subfolders named by sign:  MyVideos\HELLO\clip.mp4
REM    B) files named by sign:       MyVideos\HELLO.mp4
REM ============================================================
title Gesturia - video extraction
set "ROOT=%~1"
if "%ROOT%"=="" set /p ROOT=Drag a folder of sign videos here (or paste its path) then press Enter:
set ROOT=%ROOT:"=%
if "%ROOT%"=="" ( echo No folder given. & pause & exit /b )
echo.
echo   Extracting signs from: %ROOT%
echo   Multi-HMR + WiLoR on the GPU. Progress below (resumable - safe to re-run).
echo.
"C:\gesturia-train\wilor_venv\Scripts\python.exe" -u "C:\gesturia-train\multihmr\extract_folder.py" --root "%ROOT%"
echo.
pause
