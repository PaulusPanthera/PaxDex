@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py scripts\validate_data.py
) else (
  python scripts\validate_data.py
)
echo.
pause
