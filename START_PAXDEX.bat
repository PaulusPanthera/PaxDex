@echo off
setlocal
cd /d "%~dp0"
set PORT=8767
where py >nul 2>nul
if %errorlevel%==0 (
  start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 800; Start-Process 'http://localhost:%PORT%'"
  echo PaxDex is running at http://localhost:%PORT%
  echo Keep this window open. Press Ctrl+C to stop.
  py -m http.server %PORT%
  exit /b
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 800; Start-Process 'http://localhost:%PORT%'"
  echo PaxDex is running at http://localhost:%PORT%
  echo Keep this window open. Press Ctrl+C to stop.
  python -m http.server %PORT%
  exit /b
)
echo Python was not found. Install Python 3 or run a local web server in this folder.
pause
