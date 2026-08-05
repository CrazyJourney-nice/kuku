@echo off
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18+ is required. Download: https://nodejs.org/
  pause
  exit /b 1
)

node server.mjs --open
pause
